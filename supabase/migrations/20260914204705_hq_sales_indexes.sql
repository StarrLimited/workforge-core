-- Cover composite customer/test links identified by the database advisor.
create index hq_opportunities_customer_link on public.hq_opportunities(workspace_id,account_id);
create index hq_proposals_customer_opportunity on public.hq_proposals(workspace_id,opportunity_id,account_id);
create index hq_beta_runs_test_project on public.hq_beta_runs(test_id,implementation_id);
