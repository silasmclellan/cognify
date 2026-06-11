'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, Users, BookOpen, Plus, Trash2, Mail, CheckCircle, Clock, BarChart2 } from 'lucide-react';

interface OrgData {
  id: string; name: string; member_count: number; employee_limit: number; owner_user_id: string;
}
interface Member {
  id: string; invite_email: string; role: string; status: string; user_name: string | null; user_email: string | null; assigned_courses: number;
}
interface Assignment {
  id: string; course_title: string; assignee_name: string; assignee_email: string; due_date: string | null; completedLessons: number;
}
interface Course {
  id: string; title: string; topic: string;
}

export default function BusinessPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [org, setOrg] = useState<OrgData | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDue, setAssignDue] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/signin?callbackUrl=/business'); return; }
    if (status === 'authenticated') loadOrg();
  }, [status]);

  const loadOrg = async () => {
    setOrgLoading(true);
    const res = await fetch('/api/business/org');
    const data = await res.json();
    if (data.org) {
      setOrg(data.org);
      loadMembers(data.org.id);
      loadAssignments(data.org.id);
      loadCourses();
    } else if (data.membership) {
      // Employee — redirect to dashboard
      router.push('/dashboard');
    }
    setOrgLoading(false);
  };

  const loadMembers = async (orgId: string) => {
    const res = await fetch(`/api/business/members?orgId=${orgId}`);
    const data = await res.json();
    setMembers(data.members ?? []);
  };

  const loadAssignments = async (orgId: string) => {
    const res = await fetch(`/api/business/assignments?orgId=${orgId}`);
    const data = await res.json();
    setAssignments(data.assignments ?? []);
  };

  const loadCourses = async () => {
    const res = await fetch('/api/courses');
    const data = await res.json();
    setCourses(Array.isArray(data) ? data : []);
  };

  const createOrg = async () => {
    if (!orgName.trim()) { setCreateError('Name is required'); return; }
    setCreatingOrg(true); setCreateError('');
    const res = await fetch('/api/business/org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: orgName.trim() }),
    });
    const data = await res.json();
    if (res.status === 402) {
      setCreateError('A Business subscription is required. ');
      setCreatingOrg(false); return;
    }
    if (!res.ok) { setCreateError(data.error ?? 'Failed'); setCreatingOrg(false); return; }
    await loadOrg();
    setCreatingOrg(false);
  };

  const inviteMember = async () => {
    if (!org || !inviteEmail.trim()) return;
    setInviting(true); setInviteError('');
    const res = await fetch('/api/business/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: org.id, email: inviteEmail.trim().toLowerCase() }),
    });
    const data = await res.json();
    if (!res.ok) { setInviteError(data.error ?? 'Failed'); setInviting(false); return; }
    setInviteEmail('');
    await loadMembers(org.id);
    setInviting(false);
  };

  const removeMember = async (memberId: string) => {
    if (!org || !confirm('Remove this member?')) return;
    await fetch('/api/business/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, orgId: org.id }),
    });
    await loadMembers(org.id);
  };

  const assignCourse = async () => {
    if (!org || !assignCourseId || !assignUserId) return;
    setAssigning(true);
    await fetch('/api/business/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: org.id, courseId: assignCourseId, assignToUserId: assignUserId, dueDate: assignDue || null }),
    });
    setShowAssignModal(false); setAssignCourseId(''); setAssignUserId(''); setAssignDue('');
    await loadAssignments(org.id);
    setAssigning(false);
  };

  const removeAssignment = async (id: string) => {
    if (!org || !confirm('Remove this assignment?')) return;
    await fetch('/api/business/assignments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignmentId: id, orgId: org.id }),
    });
    await loadAssignments(org.id);
  };

  if (status === 'loading' || orgLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="spinner" /></div>;
  }

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between px-10 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <Link href="/dashboard" style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, textDecoration: 'none' }}>
          ← Pansophia
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={16} color="var(--text-muted)" />
          <span style={{ fontWeight: 600, fontSize: 15 }}>Business</span>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '56px 24px 80px' }}>
        {!org ? (
          /* ── No org yet ── */
          <div style={{ textAlign: 'center', maxWidth: 480, margin: '0 auto' }}>
            <Building2 size={48} color="var(--text-faint)" style={{ margin: '0 auto 24px' }} />
            <h2 style={{ fontSize: 28, marginBottom: 12 }}>Create your Business account</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>
              Invite your team, assign courses, and track employee progress — all from one dashboard.
              Requires a <Link href="/pricing" style={{ color: 'var(--accent)' }}>Business subscription</Link>.
            </p>
            <input
              className="input-field"
              placeholder="Company or team name"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              style={{ width: '100%', marginBottom: 12 }}
            />
            {createError && (
              <p style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>
                {createError}
                {createError.includes('Business subscription') && (
                  <Link href="/pricing" style={{ color: 'var(--accent)', marginLeft: 4 }}>Upgrade →</Link>
                )}
              </p>
            )}
            <button className="btn-primary" style={{ width: '100%' }} onClick={createOrg} disabled={creatingOrg}>
              {creatingOrg ? <span className="spinner" /> : 'Create organisation'}
            </button>
          </div>
        ) : (
          /* ── Org dashboard ── */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
              <div>
                <h1 style={{ fontSize: 32, marginBottom: 4 }}>{org.name}</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                  {members.filter(m => m.status === 'active').length} / {org.employee_limit} active employees
                </p>
              </div>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => setShowAssignModal(true)}>
                <Plus size={15} /> Assign Course
              </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 }}>
              {[
                { icon: Users, label: 'Members', value: members.length },
                { icon: BookOpen, label: 'Active assignments', value: assignments.length },
                { icon: BarChart2, label: 'Completed lessons', value: assignments.reduce((s, a) => s + (a.completedLessons ?? 0), 0) },
              ].map(stat => (
                <div key={stat.label} className="card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <stat.icon size={22} color="var(--accent)" />
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{stat.value}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-faint)' }}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Invite section */}
            <div className="card" style={{ padding: '24px', marginBottom: 32 }}>
              <h3 style={{ fontSize: 17, marginBottom: 16 }}>Invite employee</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  className="input-field" placeholder="employee@company.com"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && inviteMember()}
                  style={{ flex: 1 }}
                />
                <button className="btn-primary" onClick={inviteMember} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? <span className="spinner" /> : <><Mail size={14} /> Invite</>}
                </button>
              </div>
              {inviteError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{inviteError}</p>}
            </div>

            {/* Members table */}
            <div className="card" style={{ padding: '24px', marginBottom: 32 }}>
              <h3 style={{ fontSize: 17, marginBottom: 20 }}>Team members</h3>
              {members.length === 0 ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>No members yet. Invite someone above.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Name / Email', 'Status', 'Assigned', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0 0 10px', color: 'var(--text-faint)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 0' }}>
                          <div style={{ fontWeight: 600 }}>{m.user_name ?? '—'}</div>
                          <div style={{ color: 'var(--text-faint)', fontSize: 13 }}>{m.user_email ?? m.invite_email}</div>
                        </td>
                        <td style={{ padding: '12px 0' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                            background: m.status === 'active' ? '#22c55e22' : '#eab30822',
                            color: m.status === 'active' ? '#22c55e' : '#eab308',
                          }}>
                            {m.status === 'active' ? <CheckCircle size={11} /> : <Clock size={11} />}
                            {m.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>{m.assigned_courses ?? 0} courses</td>
                        <td style={{ padding: '12px 0', textAlign: 'right' }}>
                          <button onClick={() => removeMember(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Assignments table */}
            <div className="card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: 17, marginBottom: 20 }}>Course assignments</h3>
              {assignments.length === 0 ? (
                <p style={{ color: 'var(--text-faint)', fontSize: 14 }}>No courses assigned yet.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Course', 'Assigned to', 'Due', 'Progress', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '0 0 10px', color: 'var(--text-faint)', fontWeight: 600, fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map(a => (
                      <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 0', fontWeight: 600 }}>{a.course_title}</td>
                        <td style={{ padding: '12px 0' }}>
                          <div>{a.assignee_name}</div>
                          <div style={{ color: 'var(--text-faint)', fontSize: 12 }}>{a.assignee_email}</div>
                        </td>
                        <td style={{ padding: '12px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                          {a.due_date ? new Date(a.due_date).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '12px 0', color: 'var(--text-muted)' }}>{a.completedLessons ?? 0} lessons done</td>
                        <td style={{ padding: '12px 0', textAlign: 'right' }}>
                          <button onClick={() => removeAssignment(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)' }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* Assign modal */}
      {showAssignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: 420, padding: 32 }}>
            <h3 style={{ fontSize: 20, marginBottom: 24 }}>Assign a course</h3>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Course</label>
              <select className="input-field" style={{ width: '100%' }} value={assignCourseId} onChange={e => setAssignCourseId(e.target.value)}>
                <option value="">Select a course…</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Employee</label>
              <select className="input-field" style={{ width: '100%' }} value={assignUserId} onChange={e => setAssignUserId(e.target.value)}>
                <option value="">Select an employee…</option>
                {members.filter(m => m.status === 'active').map(m => (
                  <option key={m.id} value={m.id}>{m.user_name ?? m.user_email ?? m.invite_email}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Due date (optional)</label>
              <input type="date" className="input-field" style={{ width: '100%' }} value={assignDue} onChange={e => setAssignDue(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAssignModal(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={assignCourse} disabled={assigning || !assignCourseId || !assignUserId}>
                {assigning ? <span className="spinner" /> : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
