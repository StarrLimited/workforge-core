-- Run only AFTER /api/version on the deployed application reports version 0.2.0.
-- Activates the required walkthrough for existing Field workspaces.
update public.workspaces set field_workflow_version=2 where model='field' and field_workflow_version=1;
select name,field_workflow_version from public.workspaces where model='field';
