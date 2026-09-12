'use client';

import { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import { canWrite, type DataSet, type Partner, type PartnerLocation } from '@/lib/core';
import { PARTNER_LABELS } from '@/lib/field-options';
import { CheckField, Empty, SaveForm } from './forms';

const addressFor=(location:PartnerLocation)=>[location.address,location.city,[location.region,location.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');

export function Partners({data:d}:{data:DataSet}) {
  const [selected,setSelected]=useState<string|null>(null);
  const [filter,setFilter]=useState('all');
  const partner=d.partners.find(p=>p.id===selected);
  const partners=d.partners.filter(p=>filter==='all'||p.kind===filter);
  return <div className="partners-workspace">
    <div className="field-toolbar">
      <span className="muted">Crews, subcontractors and supplier records</span>
      <select aria-label="Partner type" value={filter} onChange={e=>{setFilter(e.target.value);setSelected(null);}}>
        <option value="all">All partners</option><option value="vendor">Material vendors</option><option value="subcontractor">Subcontractors</option><option value="crew">Internal crews</option>
      </select>
    </div>
    <div className="partner-grid">
      {partners.map(p=>{
        const locations=[...(p.locations??[])].sort((a,b)=>a.name.localeCompare(b.name));
        const location=locations[0];
        return <button className={`panel partner-detail-card ${selected===p.id?'selected':''}`} key={p.id} aria-expanded={selected===p.id} aria-controls="partner-detail" onClick={()=>setSelected(p.id)}>
          <div className="card-meta"><span className="service-tag">{PARTNER_LABELS[p.kind]}</span><span className={p.status==='active'?'success-text':'attention-text'}>{p.status}</span></div>
          <h3>{p.name}</h3><p>{p.trade||'Trade / category not set'}</p><small>{p.contact_name||p.phone||'Open partner record'}</small>
          <div className="partner-area-summary"><MapPin size={16}/><span>
            {p.kind==='vendor'?<><strong>{locations.length?`${locations.length} ${locations.length===1?'location':'locations'}`:'No locations added'}</strong>{location&&<small>{location.name} · {[location.city,location.region].filter(Boolean).join(', ')||location.address}</small>}</>:<><strong>{p.primary_region||'Primary region not set'}</strong>{p.coverage_area&&<small>{p.coverage_area}</small>}</>}
          </span></div>
          {p.kind==='subcontractor'&&<div className="compliance-strip"><span>{p.w9?'W-9 recorded':'W-9 missing'}</span><span>{p.agreement?'Agreement recorded':'Agreement missing'}</span></div>}
        </button>;
      })}
    </div>
    {!partners.length&&<Empty>No partners in this category yet.</Empty>}
    {partner&&<section id="partner-detail" className="panel inline-editor partner-editor" aria-labelledby="partner-detail-heading">
      <div className="section-heading flush"><div><p className="eyebrow">{PARTNER_LABELS[partner.kind]}</p><h2 id="partner-detail-heading">{partner.name}</h2></div><button className="quiet" onClick={()=>setSelected(null)}>Close</button></div>
      <PartnerForm key={partner.id} partner={partner} workspaceId={d.workspace.id} writable={canWrite(d.role)}/>
      {partner.kind==='vendor'&&<VendorLocations key={partner.id} partner={partner} workspaceId={d.workspace.id} writable={canWrite(d.role)}/>}
    </section>}
  </div>;
}

function PartnerForm({partner:p,workspaceId,writable}:{partner:Partner;workspaceId:string;writable:boolean}) {
  return <SaveForm workspaceId={workspaceId} action="edit_partner" writable={writable} extra={{id:p.id}}>
    <div className="form-grid">
      <label>Name<input name="name" required maxLength={200} defaultValue={p.name}/></label>
      <label>Contact person<input name="contact_name" maxLength={200} defaultValue={p.contact_name}/></label>
      <label>Email<input name="email" type="email" maxLength={254} defaultValue={p.email}/></label>
      <label>Phone<input name="phone" type="tel" maxLength={40} defaultValue={p.phone}/></label>
      <label>Trade / category<input name="trade" maxLength={200} defaultValue={p.trade}/></label>
      <label>Status<select name="status" defaultValue={p.status}><option value="active">Active</option><option value="hold">On hold</option><option value="inactive">Inactive</option></select></label>
    </div>
    {p.kind!=='vendor'&&<section className="partner-form-section">
      <h3>Region & coverage</h3>
      <label>Primary region of operation<input name="primary_region" maxLength={200} defaultValue={p.primary_region} placeholder="e.g. Colorado Springs / Pikes Peak region"/></label>
      <label>Coverage area<textarea name="coverage_area" rows={3} maxLength={2000} defaultValue={p.coverage_area} placeholder="Cities, counties, travel radius, or areas served. e.g. Colorado Springs, Monument and Fountain; up to 45 miles."/></label>
    </section>}
    <label>Insurance expiration<input type="date" name="coi_expires" defaultValue={p.coi_expires??''}/></label>
    <div className="check-row"><CheckField name="w9" label="W-9 recorded" checked={p.w9}/><CheckField name="agreement" label="Agreement recorded" checked={p.agreement}/></div>
    <label>Partner / compliance notes<textarea name="notes" rows={3} maxLength={5000} defaultValue={p.notes}/></label>
    <p className="muted small">Partners on hold or inactive cannot receive new job assignments or issued purchase orders.</p>
  </SaveForm>;
}

function VendorLocations({partner:p,workspaceId,writable}:{partner:Partner;workspaceId:string;writable:boolean}) {
  const [editing,setEditing]=useState<string|null>(null);
  const locations=[...(p.locations??[])].sort((a,b)=>a.name.localeCompare(b.name));
  const location=locations.find(l=>l.id===editing);
  return <section className="vendor-locations" aria-labelledby="vendor-locations-heading">
    <div className="section-heading flush"><div><h3 id="vendor-locations-heading">Vendor locations</h3><p className="muted small">Save each branch, yard or pickup location separately.</p></div>{writable&&<button className="secondary" disabled={editing==='new'} onClick={()=>setEditing('new')}><Plus size={16}/>Add location</button>}</div>
    {editing&&<section className="location-editor">
      <div className="section-heading flush"><h4>{location?'Edit location':'New location'}</h4><button className="quiet" onClick={()=>setEditing(null)}>Cancel</button></div>
      <SaveForm key={editing} workspaceId={workspaceId} action="partner_location" writable={writable} extra={{partner_id:p.id,...(location?{id:location.id}:{})}} label="Save location" onSaved={()=>setEditing(null)}>
        <label>Location name<input name="name" required maxLength={200} defaultValue={location?.name} placeholder="e.g. Denver yard"/></label>
        <label>Street address<input name="address" required maxLength={400} defaultValue={location?.address} placeholder="Street address, suite or yard entrance"/></label>
        <div className="form-grid three">
          <label>City<input name="city" maxLength={100} defaultValue={location?.city}/></label>
          <label>State / province<input name="region" maxLength={100} defaultValue={location?.region}/></label>
          <label>ZIP / postal code<input name="postal_code" maxLength={20} defaultValue={location?.postal_code}/></label>
        </div>
        <div className="form-grid"><label>Location contact<input name="contact_name" maxLength={200} defaultValue={location?.contact_name}/></label><label>Location phone<input name="phone" type="tel" maxLength={40} defaultValue={location?.phone}/></label></div>
        <label>Hours, pickup instructions & notes<textarea name="notes" rows={3} maxLength={2000} defaultValue={location?.notes}/></label>
      </SaveForm>
    </section>}
    <div className="vendor-location-list">{locations.map(l=><article className="vendor-location-card" key={l.id}>
      <div className="location-heading"><MapPin size={18}/><h4>{l.name}</h4>{writable&&<button className="quiet" onClick={()=>setEditing(l.id)}>Edit location</button>}</div>
      <p className="location-address">{addressFor(l)}</p>
      {(l.contact_name||l.phone)&&<p className="muted small">{[l.contact_name,l.phone].filter(Boolean).join(' · ')}</p>}
      {l.notes&&<p className="location-notes">{l.notes}</p>}
      {writable&&<details className="location-remove"><summary>Remove location</summary><p className="muted small">Remove {l.name} from this vendor?</p><SaveForm workspaceId={workspaceId} action="remove_partner_location" extra={{id:l.id,partner_id:p.id}} label="Remove location" onSaved={()=>{if(editing===l.id)setEditing(null);}}><span className="small">The vendor and its other locations will remain.</span></SaveForm></details>}
    </article>)}</div>
    {!locations.length&&!editing&&<Empty>No vendor locations yet. Add a branch, yard or pickup address.</Empty>}
  </section>;
}
