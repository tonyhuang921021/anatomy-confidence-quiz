"""Import unchanged, hash-verified accepted Library readers using explicit question mappings."""
import argparse
import collections
import difflib
import hashlib
import html
import importlib.util
import json
import re
from pathlib import Path
from html.parser import HTMLParser

spec = importlib.util.spec_from_file_location("reader_import", Path(__file__).with_name("import-reviewed-readers.py"))
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
VOID = set("area base br col embed hr img input link meta param source track wbr".split())
ANCHOR_EXCEPTIONS = {
    "MOEX-115020-1301-Q095": "moex-med1-supplement-v5-115020-1301-095",
    "MOEX-115020-1301-Q098": "moex-med1-supplement-v5-115020-1301-098",
    "MOEX-115020-2301-Q069": "q68_q69",
}

class Node:
    def __init__(self, tag="", attrs=(), children=None):
        self.tag, self.attrs, self.children = tag, dict(attrs), children or []
    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()
    def classes(self):
        return set(self.attrs.get("class", "").split())
    def text(self):
        return "".join(c.text() if isinstance(c, Node) else c for c in self.children)
    def render(self):
        contents = "".join(c.render() if isinstance(c, Node) else html.escape(c) for c in self.children)
        if not self.tag:
            return contents
        opening = "<" + self.tag + "".join(' '+k+'="'+html.escape(v or "", quote=True)+'"' for k,v in self.attrs.items()) + ">"
        return opening if self.tag in VOID else opening + contents + "</"+self.tag+">"

class Tree(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                break
    def handle_data(self, data):
        self.stack[-1].children.append(data)

def panel_kind(n):
    explicit=n.attrs.get("data-length-panel") or n.attrs.get("data-reading-length-panel")
    if explicit:
        return explicit
    if n.tag in {"section","div"}:
        if n.classes() & {"short","brief"}:
            return "short"
        if "detailed" in n.classes():
            return "detailed"

def cleaned_tree(node, mode="detailed"):
    # Strip only marked original exam blocks and source-reader UI, preserving explanation prose.
    classes = node.classes()
    if classes & {"eyebrow", "meta", "citation", "question", "stem", "original-stem", "options",
                  "tocback", "reading-length-switch", "panel-label"}:
        # Some original questions have necessary diagrams, which must remain available.
        return Node(children=[Node("figure", children=[n]) for n in node.walk() if n.tag == "img"]) if classes & {"question","stem","original-stem"} else None
    if node.tag in {"script", "style", "button", "input", "fieldset", "nav"}:
        return None
    kind = panel_kind(node)
    if kind and kind not in {mode, "long" if mode == "detailed" else "short"}:
        return None
    tag = {"section":"div", "article":"div", "header":"div", "footer":"p", "h1":"h2",
           "small":"span", "mark":"strong"}.get(node.tag, node.tag)
    result = Node(tag, node.attrs.items())
    if "answer" in classes:
        result.tag = "p"
        result.attrs["class"] = "answer"
    for child in node.children:
        if isinstance(child, Node):
            child = cleaned_tree(child, mode)
        if child is not None:
            result.children.append(child)
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("source_root")
    args=parser.parse_args()
    root=Path(args.source_root)
    manifest=json.loads((root/"complete-reader-transfer-inventory.json").read_text())["source_manifest"]
    bank=json.loads(Path("evidence/explanations/canonical-question-bank.json").read_text())
    canonical={q["id"]:q for q in bank}
    by_exam=collections.defaultdict(list)
    for q in bank:
        by_exam[(q.get("examCode"),q.get("paperCode"),q.get("originalQuestionNumber"))].append(q)
    out=Path("public/reviewed-explanations")
    index=json.loads(Path("data/reviewedExplanationIndex.json").read_text())
    audit={"sources":[], "questions":[], "issues":[], "caveats":manifest["caveats"]}
    grouped=collections.defaultdict(list)
    for q in manifest["questions"]:
        grouped[q["library_file_id"]].append(q)
    for f in manifest["files"]:
        if f["library_file_id"] not in grouped:
            continue
        path=root/"materialized/originals"/f["library_file_id"]/f["filename"]
        assert hashlib.sha256(path.read_bytes()).hexdigest()==f["sha256"], path
        tree=Tree(path.read_text()).root
        byanchor=collections.defaultdict(list)
        for node in tree.walk():
            if node.attrs.get("id"):
                byanchor[node.attrs["id"]].append(node)
        audit["sources"].append({k:v for k,v in f.items() if k not in {"path","xattrs"}})
        for q in grouped[f["library_file_id"]]:
            code=f'{q["year"]}'+("020" if q["session"]==1 else "090")
            # Canonical IDs, not source-local sequential chapter numbers, determine the target.
            standard_id=f'MOEX-{code}-{q["med"]}301-Q{q["question"]:03d}'
            candidates=by_exam[(code,f'{q["med"]}301',q["question"])]
            assert len(candidates)==1,(standard_id,"ambiguous canonical mapping",len(candidates))
            qid=candidates[0]["id"]
            assert qid in canonical, standard_id
            anchor=q["anchor"] or ANCHOR_EXCEPTIONS[standard_id]
            nodes=byanchor[anchor]
            assert len(nodes)==1,(qid,q["anchor"],len(nodes))
            source=nodes[0]
            if source.attrs.get("data-qid"):
                assert source.attrs["data-qid"] in {qid,ANCHOR_EXCEPTIONS.get(qid)},(qid,source.attrs)
            answer=next((n for n in source.walk() if "answer" in n.classes()),None)
            stem=next((n for n in source.walk() if n.classes() & {"stem","original-stem","question"}),None)
            if not stem:
                normalize=lambda s:re.sub(r"[^\w]","",s).lower()
                stem=next((n for n in source.children if isinstance(n,Node) and n.tag=="p"
                           and normalize(n.text())==normalize(canonical[qid]["stem"])),None)
                if stem:
                    stem.attrs["class"]="stem"
            if stem:
                source_stem="".join(c.text() if isinstance(c,Node) else c for c in stem.children
                                    if not isinstance(c,Node) or not(c.classes() & {"options"} or c.tag in {"ol","ul"}))
                normalize=lambda s:re.sub(r"[^\w]","",s).lower()
                similarity=difflib.SequenceMatcher(None,normalize(source_stem),normalize(canonical[qid]["stem"]),autojunk=False).ratio()
                if similarity<.8:
                    audit["issues"].append({"id":qid,"field":"stem","similarity":similarity,"source":source_stem,"expected":canonical[qid]["stem"]})
            else:
                audit["issues"].append({"id":qid,"field":"unmarked-stem","sample":source.text()[:350]})
            title=next((n.text() for n in source.walk() if n.tag in {"h1","h2"}),qid)
            clean=cleaned_tree(source)
            rendered=clean.render()
            sanitizer=base.Cleaner(out/"assets",qid)
            sanitizer.feed(rendered)
            full=base.layout_figures("".join(sanitizer.parts))
            shortpanel=next((n for n in source.walk() if panel_kind(n)=="short"),None)
            if shortpanel:
                shortsource=cleaned_tree(shortpanel,"short").render()
            else:
                paras=[n for n in clean.walk() if n.tag=="p" and not n.classes() & {"answer"} and len(n.text().strip())>35]
                assert paras,(qid,"no accepted paragraph")
                shortsource=paras[0].render()
            shortclean=base.Cleaner(out/"assets",qid)
            shortclean.feed(shortsource)
            short=base.layout_figures("".join(shortclean.parts))
            final=answer.text() if answer else ""
            expected=canonical[qid].get("acceptedAnswers") or [canonical[qid]["answer"]]
            source_all_credit=bool(re.search("一律給分|全給分",final))
            if source_all_credit:
                answer_matches=canonical[qid].get("answerCreditType")=="all_credit"
            else:
                answer_matches=bool(final) and all(a in final for a in expected)
            if not answer_matches:
                audit["issues"].append({"id":qid,"field":"answer","source":final,"expected":expected})
            batch=f'{q["year"]}-{q["session"]}-med{q["med"]}'
            version=str(f.get("verified_current_version") or f.get("index_declared_version") or "accepted")
            item={"id":qid,"title":title,"version":version,"batch":batch,"sourceSha256":f["sha256"],
                  "sourceLibraryId":f["library_file_id"],"sourceAnchor":anchor,"shortHtml":short,
                  "html":full,"imageCount":len(sanitizer.assets),"sourceAnswer":final}
            (out/(qid+".json")).write_text(json.dumps(item,ensure_ascii=False,separators=(",",":")))
            index[qid]={"title":title,"version":version,"batch":batch}
            audit["questions"].append({"id":qid,"sourceLibraryId":f["library_file_id"],"sourceAnchor":anchor,
                                      "sourceSha256":f["sha256"],"assets":sanitizer.assets,"finalAnswer":final})
        base.DIMENSIONS_PATH.write_text(json.dumps(base.DIMENSIONS,indent=2)+"\n")
        print(f["filename"],len(grouped[f["library_file_id"]]),flush=True)
    assert len(audit["questions"])==1200
    Path("data/reviewedExplanationIndex.json").write_text(json.dumps(index,ensure_ascii=False,indent=2)+"\n")
    Path("evidence/explanations/legacy-import-audit.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"total":len(index),"legacy":1200,"issues":audit["issues"]},ensure_ascii=False))

if __name__=="__main__":
    main()
