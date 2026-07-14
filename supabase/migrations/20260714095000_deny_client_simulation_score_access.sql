-- Keep the aggregate source server-only even if table grants change later.
drop policy if exists simulation_paper_scores_no_client_access
  on public.simulation_paper_scores;

create policy simulation_paper_scores_no_client_access
  on public.simulation_paper_scores
  for all
  to anon, authenticated
  using (false)
  with check (false);
