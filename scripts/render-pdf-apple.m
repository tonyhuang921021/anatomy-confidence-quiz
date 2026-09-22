// Native macOS PDFKit/Quartz regression helper; renders only the supplied test PDF.

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <PDFKit/PDFKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
int main(int argc, char *argv[]) {
 @autoreleasepool {
  if(argc<3)return 2;
  NSURL *source=[NSURL fileURLWithPath:[NSString stringWithUTF8String:argv[1]]];
  NSString *prefix=[NSString stringWithUTF8String:argv[2]];
  PDFDocument *doc=[[PDFDocument alloc] initWithURL:source];
  PDFPage *page=[doc pageAtIndex:0];
  if(!doc || !page)return 3;
  NSImage *thumb=[page thumbnailOfSize:NSMakeSize(1190,1684) forBox:kPDFDisplayBoxMediaBox];
  NSBitmapImageRep *bitmap=[NSBitmapImageRep imageRepWithData:[thumb TIFFRepresentation]];
  NSData *png=[bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
  if(![png writeToFile:[prefix stringByAppendingString:@"-pdfkit.png"] atomically:YES])return 4;
  CGPDFDocumentRef cgdoc=CGPDFDocumentCreateWithURL((__bridge CFURLRef)source);
  CGPDFPageRef cgpage=CGPDFDocumentGetPage(cgdoc,1);
  CGRect box=CGPDFPageGetBoxRect(cgpage,kCGPDFMediaBox);
  size_t w=(size_t)(box.size.width*2),h=(size_t)(box.size.height*2);
  CGColorSpaceRef color=CGColorSpaceCreateDeviceRGB();
  CGContextRef ctx=CGBitmapContextCreate(NULL,w,h,8,0,color,kCGImageAlphaPremultipliedLast);
  CGContextSetRGBFillColor(ctx,1,1,1,1);CGContextFillRect(ctx,CGRectMake(0,0,w,h));
  CGContextScaleCTM(ctx,2,2);CGContextDrawPDFPage(ctx,cgpage);
  CGImageRef image=CGBitmapContextCreateImage(ctx);
  NSURL *output=[NSURL fileURLWithPath:[prefix stringByAppendingString:@"-quartz.png"]];
  CGImageDestinationRef dest=CGImageDestinationCreateWithURL((__bridge CFURLRef)output,CFSTR("public.png"),1,NULL);
  CGImageDestinationAddImage(dest,image,NULL);
  if(!CGImageDestinationFinalize(dest))return 5;
  NSDictionary *report=@{@"pages":@(doc.pageCount),@"text":page.string ?: @"",@"width":@(w),@"height":@(h)};
  NSData *json=[NSJSONSerialization dataWithJSONObject:report options:0 error:nil];
  fwrite(json.bytes,1,json.length,stdout);fputc('\n',stdout);
  CFRelease(dest);CGImageRelease(image);CGContextRelease(ctx);CGColorSpaceRelease(color);CGPDFDocumentRelease(cgdoc);
 }
 return 0;
}
