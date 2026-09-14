'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, ClipboardList, DollarSign, LayoutDashboard, ListTodo, LogOut, Menu, Plus, Search, Settings2, X } from 'lucide-react';
import BrandLogo from '@/components/brand-logo';
import { signOut } from '@/app/actions';
import { mutateHQ } from '@/app/hq/actions';
import { canWrite, dateLabel } from '@/lib/core';
import { HQ_STAGES, HQ_STAGE_LABELS, HQ_DELIVERY_LABELS, HQ_SERVICE_LABELS, hqMetrics, hqDay, type HQAccount, type HQData, type HQTask } from '@/lib/hq';
import { HQDialog, HQRecordForm, type HQForm } from './forms';

type View = 'overview' | 'pipeline' | 'customers' | 'implementations' | 'tasks' | 'calendar' | 'commercial';
const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'pipeline', label: 'Sales pipeline', icon: ClipboardList },
  { id: 'customers', label: 'Customer accounts', icon: Building2 }, { id: 'implementations', label: 'Implementations', icon: Settings2 },
  { id: 'tasks', label: 'Tasks', icon: ListTodo }, { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'commercial', label: 'Commercial', icon: DollarSign },
] as const;
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(cents / 100);
const todayInDenver = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function HQWorkbench({ data: d }: { data: HQData }) {
  const router = useRouter();
  const [view, setView] = useState<View>('overview');
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<HQForm | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [taskFilter, setTaskFilter] = useState('open');
  const [month, setMonth] = useState(() => todayInDenver().slice(0, 7));
  const today = todayInDenver();
  const writable = canWrite(d.role);
  const metrics = hqMetrics(d, today);
  const account = d.accounts.find(a => a.id === accountId);
  const name = (id: string | null) => d.accounts.find(a => a.id === id)?.company ?? 'Internal';
  const matches = (value: string) => value.toLowerCase().includes(search.toLowerCase());
  const accounts = d.accounts.filter(a => matches(`${a.company} ${a.contact_name} ${a.email} ${a.phone} ${a.owner}`));
  const due = (value: string | null, done = false) => <span className={!done && value && value < today ? 'hq-overdue' : 'hq-muted'}>{value ? hqDay(value) : 'No date set'}</span>;
  const show = (f: HQForm) => { setError(''); setForm(f); };
  const openAccount = (id: string) => { setError(''); setAccountId(id); };
  function navigate(next: View) { setView(next); setSearch(''); setMobile(false); setError(''); }
  async function run(action: string, fd: FormData, close = true) {
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await mutateHQ(action, fd);
      if (!result.ok) { setError(result.error ?? 'Unable to save.'); return; }
      if (close) setForm(null);
      setMessage(action === 'stage' && fd.get('stage') === 'won' ? 'Account won. Implementation and onboarding tasks created.' : 'Changes saved.');
      router.refresh();
    } catch { setError('Unable to save. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!form || busy) return;
    const fd = new FormData(e.currentTarget);
    if (form.kind === 'event') for (const k of ['starts_at', 'ends_at']) fd.set(k, new Date(String(fd.get(k))).toISOString());
    await run(form.kind, fd);
  }
  function toggle(task: HQTask) { const fd = new FormData(); fd.set('id', task.id); fd.set('updated_at', task.updated_at); fd.set('completed', String(!task.completed)); void run('toggle_task', fd, false); }
  const empty = (title: string, hint: string, action?: { label: string; onClick: () => void }) => <div className="hq-empty"><ClipboardList size={28}/><h3>{title}</h3><p>{hint}</p>{action && writable && <button className="primary" onClick={action.onClick}><Plus size={17}/>{action.label}</button>}</div>;
  const taskRows = (tasks: HQTask[]) => <div className="hq-list">{tasks.map(t => <div className="hq-task-row" key={t.id}>
    <button className={`hq-check ${t.completed ? 'checked' : ''}`} disabled={!writable || busy} aria-label={`${t.completed ? 'Reopen' : 'Complete'} ${t.title}`} aria-pressed={t.completed} onClick={() => toggle(t)}>{t.completed && <Check size={16}/>}</button>
    <button className="hq-text-button" disabled={!writable} onClick={() => show({ kind: 'task', record: t })}><strong className={t.completed ? 'hq-completed' : ''}>{t.title}</strong><span>{name(t.account_id)} · {t.owner}</span></button>{due(t.due_on, t.completed)}</div>)}</div>;
  function accountTable(rows: HQAccount[]) { return <div className="hq-table-wrap"><table className="hq-table"><thead><tr><th>Account</th><th>Contact</th><th>Stage</th><th>Owner / next action</th><th>Follow-up</th></tr></thead><tbody>{rows.map(a => <tr key={a.id}><td><button className="hq-link" onClick={() => openAccount(a.id)}>{a.company}<ArrowRight size={16}/></button><small>{a.source}</small></td><td>{a.contact_name}<small>{a.phone || a.email}</small></td><td><span className={`hq-badge ${a.stage}`}>{HQ_STAGE_LABELS[a.stage]}</span></td><td>{a.owner}<small>{a.next_action}</small></td><td>{due(a.due_on, ['won', 'lost'].includes(a.stage))}</td></tr>)}</tbody></table></div>; }

  const allCalendar = [
    ...d.events.map(e => ({ id: e.id, day: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(e.starts_at)), title: e.title, detail: dateLabel(e.starts_at), kind: 'event' as const, record: e })),
    ...d.tasks.filter(t => !t.completed && t.due_on).map(t => ({ id: t.id, day: t.due_on!, title: t.title, detail: `${t.owner} · Task`, kind: 'task' as const, record: t })),
    ...d.accounts.filter(a => !['won', 'lost'].includes(a.stage) && a.due_on).map(a => ({ id: a.id, day: a.due_on!, title: a.company, detail: a.next_action, kind: 'account' as const, record: a })),
    ...d.implementations.filter(i => i.target_on && i.status !== 'live').map(i => ({ id: i.id, day: i.target_on!, title: `${name(i.account_id)} launch`, detail: i.owner, kind: 'implementation' as const, record: i })),
  ].sort((a, b) => a.day.localeCompare(b.day));
  function calendarClick(item: typeof allCalendar[number]) { if (item.kind === 'account') openAccount(item.id); else if (writable) { if (item.kind === 'task') show({ kind: 'task', record: item.record }); else if (item.kind === 'event') show({ kind: 'event', record: item.record }); else show({ kind: 'implementation', record: item.record }); } }
  const [year, monthNumber] = month.split('-').map(Number);
  const startDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  function changeMonth(step: number) { setMonth(new Date(Date.UTC(year, monthNumber - 1 + step, 1)).toISOString().slice(0, 7)); }

  return <div className="hq-shell">
    <aside className={`hq-sidebar ${mobile ? 'open' : ''}`}><div className="hq-brand"><BrandLogo/><button className="hq-mobile icon-button" aria-label="Close navigation" onClick={() => setMobile(false)}><X/></button></div>
      <div className="hq-workspace"><span>INTERNAL OPERATIONS</span><strong>WorkForge HQ</strong><small>Business workspace</small></div>
      <nav aria-label="WorkForge HQ">{NAV.map(n => <button key={n.id} aria-current={view === n.id ? 'page' : undefined} className={view === n.id ? 'active' : ''} onClick={() => navigate(n.id)}><n.icon size={19}/>{n.label}{n.id === 'tasks' && d.tasks.some(t => !t.completed) && <span>{d.tasks.filter(t => !t.completed).length}</span>}</button>)}</nav>
      <div className="hq-sidebar-bottom"><a href="/">Open product workspaces <ArrowRight size={15}/></a><small>{d.role.replace('_', ' ')} access</small><button onClick={async () => { await signOut(); router.push('/login'); }}><LogOut size={17}/>Sign out</button></div>
    </aside>
    {mobile && <button className="hq-scrim" aria-label="Close navigation" onClick={() => setMobile(false)}/>}
    <div className="hq-main-shell"><header className="hq-topbar"><div><button className="hq-mobile icon-button" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu/></button><span>WorkForge</span><ChevronRight size={15}/><strong>HQ</strong></div><span className="hq-internal">Internal workspace</span></header>
      <main className="hq-main"><div className="hq-heading"><div><p className="hq-eyebrow">{view === 'overview' ? new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver' }).format(new Date()) : 'WORKFORGE HQ'}</p><h1>{NAV.find(n => n.id === view)?.label}</h1><p>{({ overview: 'The work that moves WorkForge forward.', pipeline: 'Every inquiry, with an owner and a next step.', customers: 'One record from discovery through ongoing delivery.', implementations: 'Scope, milestones, and launches in one place.', tasks: 'Clear ownership. Visible deadlines.', calendar: 'Follow-ups, meetings, and delivery dates · Mountain Time', commercial: 'Blueprint, implementation, migration, and support commitments.' })[view]}</p></div>
      {writable && <button className="primary" onClick={() => show(view === 'tasks' ? { kind: 'task' } : view === 'calendar' ? { kind: 'event' } : view === 'commercial' ? { kind: 'engagement' } : { kind: 'account' })}><Plus size={18}/>{view === 'tasks' ? 'New task' : view === 'calendar' ? 'New event' : view === 'commercial' ? 'Add agreement' : 'New inquiry'}</button>}</div>
      {message && <div className="hq-toast" role="status"><CircleCheck size={18}/>{message}<button className="icon-button" aria-label="Dismiss message" onClick={() => setMessage('')}><X size={16}/></button></div>}
      {error && !form && <p role="alert" className="error">{error}</p>}

      {view === 'overview' && <>
        <section className="hq-metrics" aria-label="Business metrics"><div><span>Open inquiries</span><strong>{metrics.openLeads}</strong><button onClick={() => navigate('pipeline')}>View pipeline <ArrowRight size={14}/></button></div><div><span>Active implementations</span><strong>{metrics.activeImplementations}</strong><button onClick={() => navigate('implementations')}>View delivery <ArrowRight size={14}/></button></div><div><span>Monthly fees agreed</span><strong>{money(metrics.monthlyCommitted)}</strong><small>Contracted commitments</small></div><div><span>Overdue actions</span><strong className={metrics.overdue ? 'hq-overdue' : ''}>{metrics.overdue}</strong><small>Open follow-ups and tasks</small></div></section>
        <div className="hq-overview-grid"><section className="hq-panel"><header><h2>Needs attention</h2><button className="hq-link" onClick={() => navigate('tasks')}>All tasks <ArrowRight size={16}/></button></header>
          {d.accounts.filter(a => !['won', 'lost'].includes(a.stage) && a.due_on && a.due_on <= today).slice(0, 4).map(a => <button className="hq-attention" key={a.id} onClick={() => openAccount(a.id)}><div><strong>{a.company}</strong><span>{a.next_action} · {a.owner}</span></div>{due(a.due_on)}</button>)}
          {taskRows(d.tasks.filter(t => !t.completed).sort((a,b) => (a.due_on ?? '').localeCompare(b.due_on ?? '')).slice(0, 5))}
          {!d.tasks.some(t => !t.completed) && !d.accounts.some(a => !['won', 'lost'].includes(a.stage) && a.due_on && a.due_on <= today) && empty('Nothing due right now', 'New follow-ups and open tasks will appear here.', { label: 'Add a task', onClick: () => show({ kind: 'task' }) })}
        </section><section className="hq-panel"><header><h2>Sales at a glance</h2><button className="hq-link" onClick={() => navigate('pipeline')}>Open <ArrowRight size={16}/></button></header><div className="hq-funnel">{HQ_STAGES.filter(s => s !== 'lost').map(s => <button key={s} onClick={() => navigate('pipeline')}><span>{HQ_STAGE_LABELS[s]}</span><div><i style={{ width: `${Math.max(0, d.accounts.filter(a => a.stage === s).length / Math.max(1, d.accounts.length) * 100)}%` }}/></div><strong>{d.accounts.filter(a => a.stage === s).length}</strong></button>)}</div><div className="hq-panel-note">{d.accounts.length ? `${d.accounts.length} total accounts` : 'Ready for your first inquiry'}</div></section>
        <section className="hq-panel"><header><h2>Upcoming</h2><button className="hq-link" onClick={() => navigate('calendar')}>Calendar <ArrowRight size={16}/></button></header>{allCalendar.filter(e => e.day >= today).slice(0, 5).map(e => <button className="hq-attention" key={e.id} onClick={() => calendarClick(e)}><div><strong>{e.title}</strong><span>{e.detail}</span></div>{due(e.day)}</button>)}{!allCalendar.some(e => e.day >= today) && empty('No upcoming items', 'Schedule a discovery call or add a delivery date.')}</section>
        <section className="hq-panel"><header><h2>Recent activity</h2></header><div className="hq-activity">{d.activity.slice(0, 6).map(a => <div key={a.id}><CircleCheck size={15}/><div><p>{a.action.replace(/^Hq /, '')}</p><small>{dateLabel(a.created_at)}</small></div></div>)}</div>{!d.activity.length && empty('A clean starting point', 'Saved changes will appear in your activity history.')}</section></div>
      </>}

      {['pipeline', 'customers', 'implementations', 'tasks', 'commercial'].includes(view) && <div className="hq-toolbar"><label className="hq-search"><Search size={18}/><input aria-label="Search records" placeholder="Search accounts, contacts, or work…" value={search} onChange={e => setSearch(e.target.value)}/></label>{view === 'tasks' && <select aria-label="Task status" value={taskFilter} onChange={e => setTaskFilter(e.target.value)}><option value="open">Open tasks</option><option value="completed">Completed tasks</option><option value="all">All tasks</option></select>}</div>}
      {view === 'pipeline' && <><div className="hq-board">{HQ_STAGES.filter(s => s !== 'lost').map(s => <section key={s} className="hq-column"><header><h2>{HQ_STAGE_LABELS[s]}</h2><span>{accounts.filter(a => a.stage === s).length}</span></header>{accounts.filter(a => a.stage === s).map(a => <button className="hq-opportunity" key={a.id} onClick={() => openAccount(a.id)}><strong>{a.company}</strong><span>{a.contact_name}</span><p>{a.next_action}</p><footer><span>{a.owner}</span>{due(a.due_on, s === 'won')}</footer></button>)}{!accounts.some(a => a.stage === s) && <p className="hq-column-empty">No accounts</p>}</section>)}</div>{accounts.some(a => a.stage === 'lost') && <section className="hq-panel hq-spaced"><header><h2>Closed / lost</h2></header>{accountTable(accounts.filter(a => a.stage === 'lost'))}</section>}</>}
      {view === 'customers' && <section className="hq-panel">{accounts.length ? accountTable(accounts) : empty(search ? 'No matching accounts' : 'Your customer history starts here', search ? 'Try a different search.' : 'Add an inquiry to start its sales and delivery record.', { label: 'New inquiry', onClick: () => show({ kind: 'account' }) })}</section>}
      {view === 'implementations' && <div className="hq-delivery-grid">{d.implementations.filter(i => matches(`${name(i.account_id)} ${i.owner} ${i.blocker}`)).map(i => { const tasks = d.tasks.filter(t => t.implementation_id === i.id); const done = tasks.filter(t => t.completed).length; return <section className="hq-panel" key={i.id}><header><div><button className="hq-link" onClick={() => openAccount(i.account_id)}>{name(i.account_id)}<ArrowRight size={16}/></button><p className="hq-muted">{i.owner} · Target {i.target_on ? hqDay(i.target_on) : 'not set'}</p></div><span className={`hq-badge ${i.status}`}>{HQ_DELIVERY_LABELS[i.status]}</span></header><div className="hq-delivery-body"><div className="hq-progress-label"><span>Implementation checklist</span><strong>{done} / {tasks.length}</strong></div><progress aria-label={`${name(i.account_id)} implementation progress`} value={done} max={tasks.length || 1}/>{i.blocker && <p className="hq-blocker">{i.blocker}</p>}<p className="hq-scope">{i.scope_snapshot}</p>{writable && <div className="hq-actions"><button className="secondary" onClick={() => show({ kind: 'implementation', record: i })}>Update delivery</button><button className="hq-link" onClick={() => show({ kind: 'task', accountId: i.account_id, implementationId: i.id })}>Add task</button></div>}</div>{taskRows(tasks)}</section>; })}{!d.implementations.length && <section className="hq-panel">{empty('No implementations yet', 'Mark a scoped account won after recording an agreed fee. Its implementation and checklist are created automatically.')}</section>}</div>}
      {view === 'tasks' && <section className="hq-panel">{taskRows(d.tasks.filter(t => (taskFilter === 'all' || t.completed === (taskFilter === 'completed')) && matches(`${t.title} ${t.owner} ${name(t.account_id)}`)).sort((a,b) => (a.due_on ?? '').localeCompare(b.due_on ?? '')))}{!d.tasks.some(t => (taskFilter === 'all' || t.completed === (taskFilter === 'completed')) && matches(`${t.title} ${t.owner} ${name(t.account_id)}`)) && empty('No tasks in this view', 'Add a task with a clear owner and deadline.', { label: 'New task', onClick: () => show({ kind: 'task' }) })}</section>}
      {view === 'calendar' && <section className="hq-panel"><header><h2>{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`))}</h2><div className="hq-actions"><button className="icon-button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={18}/></button><button className="secondary" onClick={() => setMonth(today.slice(0,7))}>Today</button><button className="icon-button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight size={18}/></button></div></header><div className="hq-calendar">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div className="hq-weekday" key={d}>{d}</div>)}{Array.from({ length: Math.ceil((startDay + days)/7)*7 }, (_,index) => { const day = index - startDay + 1; const key = `${month}-${String(day).padStart(2,'0')}`; return <div key={index} className={`hq-calendar-cell ${day < 1 || day > days ? 'outside' : ''} ${key === today ? 'today' : ''}`}>{day > 0 && day <= days && <><strong>{day}</strong>{allCalendar.filter(e => e.day === key).map(e => <button key={e.id} title={e.detail} onClick={() => calendarClick(e)}>{e.title}</button>)}</>}</div>; })}</div><div className="hq-calendar-agenda">{allCalendar.filter(e => e.day.startsWith(month)).map(e => <button className="hq-attention" key={e.id} onClick={() => calendarClick(e)}><div><strong>{e.title}</strong><span>{e.detail}</span></div>{due(e.day)}</button>)}</div>{!allCalendar.some(e => e.day.startsWith(month)) && <p className="hq-panel-note">No scheduled items this month.</p>}</section>}
      {view === 'commercial' && <><section className="hq-metrics hq-three"><div><span>One-time fees agreed</span><strong>{money(metrics.oneTimeAgreed)}</strong><small>Excludes proposed / ended agreements</small></div><div><span>One-time balance</span><strong>{money(metrics.oneTimeOutstanding)}</strong><small>Agreed fees less recorded payments</small></div><div><span>Monthly fees agreed</span><strong>{money(metrics.monthlyCommitted)}</strong><small>Contracted, not cash collected</small></div></section><section className="hq-panel"><div className="hq-table-wrap"><table className="hq-table"><thead><tr><th>Account / service</th><th>Agreement</th><th>Fee</th><th>Paid</th><th>Status</th><th/></tr></thead><tbody>{d.engagements.filter(e => matches(`${name(e.account_id)} ${e.description} ${e.service}`)).map(e => <tr key={e.id}><td><button className="hq-link" onClick={() => openAccount(e.account_id)}>{name(e.account_id)}</button><small>{HQ_SERVICE_LABELS[e.service]}</small></td><td>{e.description}</td><td>{money(e.amount_cents)}<small>{e.cadence === 'monthly' ? 'per month' : 'one time'}</small></td><td>{e.cadence === 'monthly' ? '—' : money(e.paid_cents)}</td><td><span className={`hq-badge ${e.status}`}>{e.status}</span></td><td>{writable && <button className="hq-link" onClick={() => show({ kind: 'engagement', record: e })}>Edit</button>}</td></tr>)}</tbody></table></div>{!d.engagements.length && empty('No commercial agreements yet', 'Track each service separately so scope and fees stay clear.')}<p className="hq-panel-note">Amounts are manually recorded commitments and payments. Accounting and automated billing are not connected.</p></section></>}
      </main>
    </div>
    {account && !form && <HQDialog title={account.company} onClose={() => setAccountId(null)} busy={busy}><div className="hq-account-detail">{error && <p className="error" role="alert">{error}</p>}<div className="hq-detail-top"><span className={`hq-badge ${account.stage}`}>{HQ_STAGE_LABELS[account.stage]}</span>{writable && <div className="hq-actions"><button className="secondary" onClick={() => show({ kind: 'account', record: account })}>Edit account</button>{account.stage !== 'won' && <button className="primary" onClick={() => show({ kind: 'stage', record: account })}>Change stage</button>}</div>}</div>
      <div className="hq-detail-grid"><div><span>Primary contact</span><strong>{account.contact_name}</strong>{account.phone && <a href={`tel:${account.phone.replace(/[^\d+]/g,'')}`}>{account.phone}</a>}{account.email && <a href={`mailto:${account.email}`}>{account.email}</a>}</div><div><span>Next action · {account.owner}</span><strong>{account.next_action}</strong>{due(account.due_on, account.stage === 'won')}<small>{account.source} · {account.product === 'undecided' ? 'Product to be determined' : account.product === 'both' ? 'Field OS + Core' : account.product === 'field' ? 'Field OS' : 'Core'}</small></div></div>
      <section><h3>Requirements / agreed scope</h3><p className="hq-preserve">{account.scope || 'Scope has not been recorded.'}</p></section><section><h3>Internal notes</h3><p className="hq-preserve">{account.notes || 'No notes yet.'}</p></section>{account.stage === 'lost' && <section><h3>Reason lost</h3><p>{account.lost_reason}</p></section>}
      <section><div className="hq-section-heading"><h3>Commercial agreements</h3>{writable && <button className="hq-link" onClick={() => show({ kind: 'engagement', accountId: account.id })}><Plus size={16}/>Add fee</button>}</div>{d.engagements.filter(e => e.account_id === account.id).map(e => <button disabled={!writable} className="hq-detail-fee" key={e.id} onClick={() => show({ kind: 'engagement', record: e })}><div><strong>{HQ_SERVICE_LABELS[e.service]}</strong><span>{e.description} · {e.status}</span></div><strong>{money(e.amount_cents)}{e.cadence === 'monthly' && ' / mo'}</strong></button>)}{!d.engagements.some(e => e.account_id === account.id) && <p className="hq-muted">No fees recorded.</p>}</section>
      <section><div className="hq-section-heading"><h3>Tasks</h3>{writable && <button className="hq-link" onClick={() => show({ kind: 'task', accountId: account.id })}><Plus size={16}/>Add task</button>}</div>{taskRows(d.tasks.filter(t => t.account_id === account.id))}{!d.tasks.some(t => t.account_id === account.id) && <p className="hq-muted">No tasks linked to this account.</p>}</section>
      {d.implementations.some(i => i.account_id === account.id) && <button className="secondary" onClick={() => { setAccountId(null); navigate('implementations'); }}>Open implementations <ArrowRight size={16}/></button>}
      {writable && <button className="hq-link" onClick={() => show({ kind: 'event', accountId: account.id })}><CalendarDays size={17}/>Schedule a meeting</button>}
    </div></HQDialog>}
    {form && <HQRecordForm key={`${form.kind}-${form.record?.id ?? 'new'}`} form={form} data={d} busy={busy} error={error} onSubmit={submit} onClose={() => { setForm(null); setError(''); }}/>}
  </div>;
}
