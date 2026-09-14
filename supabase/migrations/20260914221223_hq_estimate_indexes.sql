create index hq_request_workspace on public.hq_signing_requests(workspace_id);
create index hq_mail_workspace on public.hq_mail_deliveries(workspace_id);
create index hq_gmail_oauth_user on private.hq_gmail_oauth(user_id);
