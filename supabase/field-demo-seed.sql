-- Optional illustrative catalog, confined to the fictional workspace created by seed.sql.
-- These are demonstration inputs, not recommended market prices.
insert into public.pricebook_items(workspace_id,name,category,description,unit,material_cents,labor_cents,target_margin,taxable)
select w.id,s.name,s.category,s.description,s.unit,s.material_cents,s.labor_cents,40,false
from public.workspaces w cross join (values
 ('Site preparation','Site work','Prepare the measured work area; confirm disposal and access in the site consultation.','sq ft',25::bigint,175::bigint),
 ('Landscape material installation','Landscape','Supply and install the specified landscape material to the measured area.','sq ft',225::bigint,150::bigint),
 ('Paver installation','Hardscape','Install the specified paver surface with the agreed base preparation and finish.','sq ft',600::bigint,450::bigint),
 ('Fence installation','Exterior','Supply and install the specified fence configuration. Confirm height and access in scope.','linear ft',1200::bigint,900::bigint),
 ('Irrigation service','Maintenance','Investigate and service the irrigation system; replacement components quoted separately.','hour',500::bigint,4500::bigint),
 ('Site cleanup','Maintenance','Complete the agreed site cleanup and remove the listed waste.','job',5000::bigint,10000::bigint)
) as s(name,category,description,unit,material_cents,labor_cents)
where w.name='Juniper Field Services' and w.model='field' and w.is_demo
and not exists(select 1 from public.pricebook_items p where p.workspace_id=w.id);
