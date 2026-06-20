'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Stage, Tag, Deal, DealNote, DailyLog, Goal } from '@/lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import {
  Plus, X, Check, ChevronDown, Archive, RotateCcw, Settings,
  Edit2, Trash2, MessageSquare, Phone, Calendar, Target,
  BarChart2, List, Inbox, LogIn, Save, AlertCircle
} from 'lucide-react'
import { format, subDays, startOfWeek, parseISO, isThisWeek, isToday } from 'date-fns'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const today = () => format(new Date(), 'yyyy-MM-dd')
const fmtDate = (d: string) => format(parseISO(d), 'MMM d, yyyy')
const fmtDatetime = (d: string) => format(parseISO(d), 'MMM d, yyyy · h:mm a')

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-900 text-base">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle size={20} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-700">{message}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ─── Input ───────────────────────────────────────────────────────────────────
function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        {...props}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
      />
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon }: { label: string; value: string | number; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <div className="text-gray-400">{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ label, current, goal, color = '#1A1A1A' }: { label: string; current: number; goal: number; color?: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className="text-xs font-semibold text-gray-900">{current} / {goal} <span className="text-gray-400 font-normal">({pct}%)</span></span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState<'data' | 'input' | 'crm' | 'archive' | 'goals' | 'settings'>('data')
  const [stages, setStages] = useState<Stage[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [newDealModal, setNewDealModal] = useState(false)
  const [dealDetailId, setDealDetailId] = useState<string | null>(null)
  const [archiveModal, setArchiveModal] = useState<string | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ msg: string; fn: () => void } | null>(null)
  const [chartRange, setChartRange] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  // Fetch all data
  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [s, t, d, l, g] = await Promise.all([
      supabase.from('stages').select('*').order('position'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('deals').select('*').order('created_at', { ascending: false }),
      supabase.from('daily_logs').select('*').order('date', { ascending: false }).limit(90),
      supabase.from('goals').select('*'),
    ])
    if (s.data) setStages(s.data)
    if (t.data) setTags(t.data)
    if (d.data) setDeals(d.data)
    if (l.data) setLogs(l.data)
    if (g.data) setGoals(g.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived data ──────────────────────────────────────────────────────────
  const todayLog = logs.find(l => l.date === today())
  const activeDeals = deals.filter(d => !d.is_archived)
  const archivedDeals = deals.filter(d => d.is_archived)
  const getGoal = (type: string) => goals.find(g => g.type === type)?.value || 0
  const getTag = (id: string) => tags.find(t => t.id === id)
  const getStage = (id: string | null) => stages.find(s => s.id === id)

  // Weekly totals
  const weekLogs = logs.filter(l => isThisWeek(parseISO(l.date)))
  const weekDMs = weekLogs.reduce((s, l) => s + l.dms_sent, 0)
  const weekFollowUpDMs = weekLogs.reduce((s, l) => s + (l.follow_up_dms || 0), 0)
  const weekBooked = weekLogs.reduce((s, l) => s + l.calls_booked, 0)
  const bookingRate = (todayLog?.dms_sent || 0) > 0
    ? Math.round(((todayLog?.calls_booked || 0) / (todayLog?.dms_sent || 1)) * 100) : 0

  // Chart data
  const buildChartData = () => {
    const reversed = [...logs].reverse()
    if (chartRange === 'daily') return reversed.slice(-30).map(l => ({
      name: format(parseISO(l.date), 'M/d'),
      DMs: l.dms_sent, 'Follow-Up': l.follow_up_dms || 0, Booked: l.calls_booked, Completed: l.calls_completed
    }))
    if (chartRange === 'weekly') {
      const weeks: Record<string, { DMs: number; 'Follow-Up': number; Booked: number; Completed: number }> = {}
      reversed.forEach(l => {
        const wk = format(startOfWeek(parseISO(l.date)), 'M/d')
        if (!weeks[wk]) weeks[wk] = { DMs: 0, 'Follow-Up': 0, Booked: 0, Completed: 0 }
        weeks[wk].DMs += l.dms_sent
        weeks[wk]['Follow-Up'] += l.follow_up_dms || 0
        weeks[wk].Booked += l.calls_booked
        weeks[wk].Completed += l.calls_completed
      })
      return Object.entries(weeks).slice(-12).map(([name, v]) => ({ name, ...v }))
    }
    const months: Record<string, { DMs: number; 'Follow-Up': number; Booked: number; Completed: number }> = {}
    reversed.forEach(l => {
      const mo = format(parseISO(l.date), 'MMM yy')
      if (!months[mo]) months[mo] = { DMs: 0, 'Follow-Up': 0, Booked: 0, Completed: 0 }
      months[mo].DMs += l.dms_sent
      months[mo]['Follow-Up'] += l.follow_up_dms || 0
      months[mo].Booked += l.calls_booked
      months[mo].Completed += l.calls_completed
    })
    return Object.entries(months).slice(-12).map(([name, v]) => ({ name, ...v }))
  }

  const chartData = buildChartData()

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Update today's log
  const saveLog = async (field: 'dms_sent' | 'follow_up_dms' | 'calls_booked' | 'calls_completed', val: number) => {
    const t = today()
    const existing = logs.find(l => l.date === t)
    if (existing) {
      await supabase.from('daily_logs').update({ [field]: val, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('daily_logs').insert({ date: t, [field]: val })
    }
    fetchAll()
  }

  // Move deal stage
  const moveDeal = async (dealId: string, stageId: string) => {
    await supabase.from('deals').update({ stage_id: stageId, updated_at: new Date().toISOString() }).eq('id', dealId)
    fetchAll()
  }

  // Archive deal
  const archiveDeal = async (dealId: string, reason: string) => {
    const deal = deals.find(d => d.id === dealId)
    const stageName = getStage(deal?.stage_id || null)?.name || 'Unknown'
    await supabase.from('deals').update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_stage_name: stageName,
      archive_reason: reason,
      updated_at: new Date().toISOString()
    }).eq('id', dealId)
    setArchiveModal(null)
    fetchAll()
  }

  // Restore deal
  const restoreDeal = async (dealId: string) => {
    await supabase.from('deals').update({
      is_archived: false,
      archived_at: null,
      archived_stage_name: null,
      archive_reason: null,
      updated_at: new Date().toISOString()
    }).eq('id', dealId)
    fetchAll()
  }

  // Delete deal
  const deleteDeal = async (dealId: string) => {
    await supabase.from('deal_notes').delete().eq('deal_id', dealId)
    await supabase.from('deals').delete().eq('id', dealId)
    fetchAll()
  }

  // Update goal
  const updateGoal = async (type: string, val: number) => {
    const existing = goals.find(g => g.type === type)
    if (existing) {
      await supabase.from('goals').update({ value: val, updated_at: new Date().toISOString() }).eq('id', existing.id)
    } else {
      await supabase.from('goals').insert({ type, value: val })
    }
    fetchAll()
  }

  // ── Sub-components ────────────────────────────────────────────────────────

  // Deal card
  const DealCard = ({ deal }: { deal: Deal }) => {
    const stage = getStage(deal.stage_id)
    const dealTags = (deal.tag_ids || []).map(id => getTag(id)).filter(Boolean) as Tag[]
    return (
      <div
        className="deal-card bg-white border border-gray-100 rounded-xl p-3 cursor-pointer"
        onClick={() => setDealDetailId(deal.id)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="font-semibold text-gray-900 text-sm leading-tight">{deal.prospect_name}</div>
            {deal.company && <div className="text-xs text-gray-400 mt-0.5">{deal.company}</div>}
          </div>
          <button
            className="p-1 hover:bg-gray-100 rounded-md transition-colors shrink-0"
            onClick={e => { e.stopPropagation(); setArchiveModal(deal.id) }}
            title="Archive"
          >
            <Archive size={13} className="text-gray-400" />
          </button>
        </div>
        {dealTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {dealTags.map(tag => (
              <span key={tag.id} className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + '18', color: tag.color }}>
                {tag.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{fmtDate(deal.created_at)}</span>
          <select
            className="text-xs border border-gray-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white max-w-[130px]"
            value={deal.stage_id || ''}
            onChange={e => { e.stopPropagation(); moveDeal(deal.id, e.target.value) }}
            onClick={e => e.stopPropagation()}
          >
            <option value="">No stage</option>
            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
    )
  }

  // ── Tab: DATA ─────────────────────────────────────────────────────────────
  const DataTab = () => (
    <div className="space-y-5">
      {/* Summary stats */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Today</h2>
        <div className="grid grid-cols-2 gap-2">
          <StatCard label="DMs Sent" value={todayLog?.dms_sent || 0} icon={<MessageSquare size={14} />} />
          <StatCard label="Follow-Up DMs" value={todayLog?.follow_up_dms || 0} icon={<MessageSquare size={14} />} />
          <StatCard label="Booked" value={todayLog?.calls_booked || 0} icon={<Phone size={14} />} />
          <StatCard label="Completed" value={todayLog?.calls_completed || 0} icon={<Check size={14} />} />
        </div>
      </div>

      {/* Goals progress */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Progress</h2>
        <div className="space-y-3">
          <ProgressBar label="Daily DMs" current={todayLog?.dms_sent || 0} goal={getGoal('daily_dms')} color="#1A1A1A" />
          <ProgressBar label="Daily Follow-Up DMs" current={todayLog?.follow_up_dms || 0} goal={getGoal('daily_follow_up_dms')} color="#10B981" />
          <ProgressBar label="Daily Calls Booked" current={todayLog?.calls_booked || 0} goal={getGoal('daily_calls_booked')} color="#D4622A" />
          <ProgressBar label="Weekly DMs" current={weekDMs} goal={getGoal('weekly_dms')} color="#3B82F6" />
          <ProgressBar label="Weekly Follow-Up DMs" current={weekFollowUpDMs} goal={getGoal('weekly_follow_up_dms')} color="#059669" />
          <ProgressBar label="Weekly Calls Booked" current={weekBooked} goal={getGoal('weekly_calls_booked')} color="#8B5CF6" />
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-gray-600">Booking Rate (today)</span>
              <span className="text-xs font-semibold text-gray-900">{bookingRate}% <span className="text-gray-400 font-normal">goal: {getGoal('booking_rate')}%</span></span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${Math.min(100, (bookingRate / Math.max(getGoal('booking_rate'), 1)) * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Activity Trend</h2>
          <div className="flex gap-1">
            {(['daily', 'weekly', 'monthly'] as const).map(r => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`text-xs px-2 py-1 rounded-md transition-colors capitalize ${chartRange === r ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {r === 'daily' ? 'D' : r === 'weekly' ? 'W' : 'M'}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-sm text-gray-400">No data yet — log your first day in Input</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="DMs" stroke="#1A1A1A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Follow-Up" stroke="#10B981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Booked" stroke="#D4622A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Completed" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pipeline summary */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Pipeline</h2>
        <div className="space-y-2">
          {stages.map(s => {
            const count = activeDeals.filter(d => d.stage_id === s.id).length
            return (
              <div key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-sm text-gray-700">{s.name}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{count}</span>
              </div>
            )
          })}
          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">Total Active</span>
            <span className="text-sm font-bold text-gray-900">{activeDeals.length}</span>
          </div>
        </div>
      </div>
    </div>
  )

  // ── Tab: INPUT ────────────────────────────────────────────────────────────
  const InputTab = () => {
    const [dms, setDms] = useState(todayLog?.dms_sent?.toString() || '')
    const [followUpDms, setFollowUpDms] = useState(todayLog?.follow_up_dms?.toString() || '')
    const [booked, setBooked] = useState(todayLog?.calls_booked?.toString() || '')
    const [completed, setCompleted] = useState(todayLog?.calls_completed?.toString() || '')
    const [saved, setSaved] = useState(false)

    const handleSave = async () => {
      if (dms !== '') await saveLog('dms_sent', parseInt(dms) || 0)
      if (followUpDms !== '') await saveLog('follow_up_dms', parseInt(followUpDms) || 0)
      if (booked !== '') await saveLog('calls_booked', parseInt(booked) || 0)
      if (completed !== '') await saveLog('calls_completed', parseInt(completed) || 0)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }

    const handleBookedBlur = async () => {
      const newBooked = parseInt(booked) || 0
      const prevBooked = todayLog?.calls_booked || 0
      if (newBooked > prevBooked) {
        setNewDealModal(true)
      }
    }

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Log Today's Activity</h2>
          <p className="text-xs text-gray-400 mb-4">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Outbound DMs Sent</label>
              <input
                type="number" min="0"
                value={dms}
                onChange={e => setDms(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Follow-Up DMs Sent</label>
              <input
                type="number" min="0"
                value={followUpDms}
                onChange={e => setFollowUpDms(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Calls Booked</label>
              <input
                type="number" min="0"
                value={booked}
                onChange={e => setBooked(e.target.value)}
                onBlur={handleBookedBlur}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
              />
              <p className="text-xs text-gray-400 mt-1">Adding a new booked call will prompt you to create a deal</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Calls Completed</label>
              <input
                type="number" min="0"
                value={completed}
                onChange={e => setCompleted(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
              />
            </div>
            <button
              onClick={handleSave}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}
            >
              {saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Today</>}
            </button>
          </div>
        </div>

        {/* Recent logs */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Recent Activity</h2>
          {logs.slice(0, 7).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No activity logged yet</p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 7).map(l => (
                <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{fmtDate(l.date)}</span>
                  <div className="flex gap-2 text-xs flex-wrap justify-end">
                    <span className="text-gray-900 font-medium">{l.dms_sent} DMs</span>
                    <span className="text-emerald-600 font-medium">{l.follow_up_dms || 0} FU</span>
                    <span className="text-orange-500 font-medium">{l.calls_booked} bkd</span>
                    <span className="text-blue-500 font-medium">{l.calls_completed} done</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Tab: CRM ──────────────────────────────────────────────────────────────
  const CRMTab = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{activeDeals.length} active deals</h2>
          <p className="text-xs text-gray-400">Drag column headers to reorder stages in Settings</p>
        </div>
        <button
          onClick={() => setNewDealModal(true)}
          className="flex items-center gap-1.5 bg-gray-900 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Plus size={13} /> New Deal
        </button>
      </div>

      {/* Kanban columns — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-3 pb-4" style={{ minWidth: `${stages.length * 220}px` }}>
          {stages.map(stage => {
            const stageDeals = activeDeals.filter(d => d.stage_id === stage.id)
            const unstaged = stage.position === stages[0]?.position
              ? activeDeals.filter(d => !d.stage_id)
              : []
            const allCards = stage.position === stages[0]?.position ? [...stageDeals, ...unstaged] : stageDeals
            return (
              <div key={stage.id} className="w-52 shrink-0">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                  <span className="text-xs font-semibold text-gray-700 truncate">{stage.name}</span>
                  <span className="text-xs text-gray-400 ml-auto shrink-0">{allCards.length}</span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {allCards.map(deal => <DealCard key={deal.id} deal={deal} />)}
                  {allCards.length === 0 && (
                    <div className="border-2 border-dashed border-gray-100 rounded-xl h-16 flex items-center justify-center">
                      <span className="text-xs text-gray-300">Empty</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  // ── Tab: ARCHIVE ─────────────────────────────────────────────────────────
  const ArchiveTab = () => (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 mb-1">{archivedDeals.length} archived deals</h2>
      <p className="text-xs text-gray-400 mb-4">Deals that fell through — restore or delete permanently</p>
      {archivedDeals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
          <Archive size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No archived deals yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {archivedDeals.map(deal => (
            <div key={deal.id} className="bg-white border border-gray-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{deal.prospect_name}</div>
                  {deal.company && <div className="text-xs text-gray-400">{deal.company}</div>}
                  <div className="flex flex-wrap gap-x-3 mt-1.5 text-xs text-gray-500">
                    {deal.archived_stage_name && (
                      <span>Dropped at: <span className="font-medium text-gray-700">{deal.archived_stage_name}</span></span>
                    )}
                    {deal.archived_at && (
                      <span>{fmtDate(deal.archived_at)}</span>
                    )}
                  </div>
                  {deal.archive_reason && (
                    <div className="mt-1.5 text-xs text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5 border border-gray-100">
                      {deal.archive_reason}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => restoreDeal(deal.id)}
                    className="p-1.5 hover:bg-green-50 rounded-lg transition-colors"
                    title="Restore"
                  >
                    <RotateCcw size={14} className="text-green-600" />
                  </button>
                  <button
                    onClick={() => setConfirmModal({ msg: `Permanently delete ${deal.prospect_name}?`, fn: () => deleteDeal(deal.id) })}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete permanently"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── Tab: GOALS ────────────────────────────────────────────────────────────
  const GoalsTab = () => {
    const goalDefs = [
      { type: 'daily_dms', label: 'Daily DMs Sent', icon: <MessageSquare size={14} /> },
      { type: 'weekly_dms', label: 'Weekly DMs Sent', icon: <MessageSquare size={14} /> },
      { type: 'daily_follow_up_dms', label: 'Daily Follow-Up DMs', icon: <MessageSquare size={14} /> },
      { type: 'weekly_follow_up_dms', label: 'Weekly Follow-Up DMs', icon: <MessageSquare size={14} /> },
      { type: 'daily_calls_booked', label: 'Daily Calls Booked', icon: <Phone size={14} /> },
      { type: 'weekly_calls_booked', label: 'Weekly Calls Booked', icon: <Phone size={14} /> },
      { type: 'booking_rate', label: 'DM → Call Booking Rate (%)', icon: <Target size={14} /> },
    ]
    const [vals, setVals] = useState<Record<string, string>>(
      Object.fromEntries(goalDefs.map(g => [g.type, (goals.find(x => x.type === g.type)?.value || '').toString()]))
    )
    const [saved, setSaved] = useState(false)

    const saveAll = async () => {
      await Promise.all(goalDefs.map(g => updateGoal(g.type, parseFloat(vals[g.type]) || 0)))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Set Your Goals</h2>
          <p className="text-xs text-gray-400 mb-4">These appear as progress bars on the Data tab</p>
          <div className="space-y-3">
            {goalDefs.map(g => (
              <div key={g.type}>
                <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
                  {g.icon} {g.label}
                </label>
                <input
                  type="number" min="0"
                  value={vals[g.type]}
                  onChange={e => setVals(prev => ({ ...prev, [g.type]: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                />
              </div>
            ))}
            <button
              onClick={saveAll}
              className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${saved ? 'bg-green-500 text-white' : 'bg-gray-900 text-white hover:bg-gray-700'}`}
            >
              {saved ? <><Check size={15} /> Saved!</> : <><Save size={15} /> Save Goals</>}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: SETTINGS ─────────────────────────────────────────────────────────
  const SettingsTab = () => {
    const [newStageName, setNewStageName] = useState('')
    const [newStageColor, setNewStageColor] = useState('#3B82F6')
    const [newTagName, setNewTagName] = useState('')
    const [newTagColor, setNewTagColor] = useState('#6B7280')
    const [editStage, setEditStage] = useState<Stage | null>(null)
    const [editTag, setEditTag] = useState<Tag | null>(null)

    const addStage = async () => {
      if (!newStageName.trim()) return
      const maxPos = Math.max(0, ...stages.map(s => s.position))
      await supabase.from('stages').insert({ name: newStageName.trim(), position: maxPos + 1, color: newStageColor })
      setNewStageName(''); setNewStageColor('#3B82F6')
      fetchAll()
    }

    const saveStage = async (s: Stage) => {
      await supabase.from('stages').update({ name: s.name, color: s.color }).eq('id', s.id)
      setEditStage(null); fetchAll()
    }

    const deleteStage = async (id: string) => {
      await supabase.from('deals').update({ stage_id: null }).eq('stage_id', id)
      await supabase.from('stages').delete().eq('id', id)
      fetchAll()
    }

    const addTag = async () => {
      if (!newTagName.trim()) return
      await supabase.from('tags').insert({ name: newTagName.trim(), color: newTagColor })
      setNewTagName(''); setNewTagColor('#6B7280')
      fetchAll()
    }

    const saveTag = async (t: Tag) => {
      await supabase.from('tags').update({ name: t.name, color: t.color }).eq('id', t.id)
      setEditTag(null); fetchAll()
    }

    const deleteTag = async (id: string) => {
      await supabase.from('stages').delete().eq('id', id)
      await supabase.from('tags').delete().eq('id', id)
      fetchAll()
    }

    return (
      <div className="space-y-4">
        {/* Stages */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Pipeline Stages</h2>
          <div className="space-y-2 mb-4">
            {stages.map(stage => (
              <div key={stage.id}>
                {editStage?.id === stage.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editStage.name}
                      onChange={e => setEditStage({ ...editStage, name: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <input type="color" value={editStage.color} onChange={e => setEditStage({ ...editStage, color: e.target.value })} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                    <button onClick={() => saveStage(editStage)} className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700"><Check size={14} /></button>
                    <button onClick={() => setEditStage(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded-lg group">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm text-gray-700 flex-1">{stage.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditStage(stage)} className="p-1 hover:bg-gray-200 rounded"><Edit2 size={12} className="text-gray-500" /></button>
                      <button onClick={() => setConfirmModal({ msg: `Delete stage "${stage.name}"? Deals will lose their stage.`, fn: () => deleteStage(stage.id) })} className="p-1 hover:bg-red-100 rounded"><Trash2 size={12} className="text-red-500" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addStage()}
              placeholder="Stage name"
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <input type="color" value={newStageColor} onChange={e => setNewStageColor(e.target.value)} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
            <button onClick={addStage} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-700 font-semibold whitespace-nowrap">+ Add</button>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Deal Tags</h2>
          <div className="space-y-2 mb-4">
            {tags.map(tag => (
              <div key={tag.id}>
                {editTag?.id === tag.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editTag.name}
                      onChange={e => setEditTag({ ...editTag, name: e.target.value })}
                      className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <input type="color" value={editTag.color} onChange={e => setEditTag({ ...editTag, color: e.target.value })} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                    <button onClick={() => saveTag(editTag)} className="p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700"><Check size={14} /></button>
                    <button onClick={() => setEditTag(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded-lg group">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + '20', color: tag.color }}>{tag.name}</span>
                    <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditTag(tag)} className="p-1 hover:bg-gray-200 rounded"><Edit2 size={12} className="text-gray-500" /></button>
                      <button onClick={() => setConfirmModal({ msg: `Delete tag "${tag.name}"?`, fn: () => deleteTag(tag.id) })} className="p-1 hover:bg-red-100 rounded"><Trash2 size={12} className="text-red-500" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()}
              placeholder="Tag name"
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
            <button onClick={addTag} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-700 font-semibold whitespace-nowrap">+ Add</button>
          </div>
        </div>
      </div>
    )
  }

  // ── New Deal Modal ────────────────────────────────────────────────────────
  const NewDealModal = () => {
    const [name, setName] = useState('')
    const [company, setCompany] = useState('')
    const [stageId, setStageId] = useState(stages[0]?.id || '')
    const [selectedTags, setSelectedTags] = useState<string[]>([])
    const [saving, setSaving] = useState(false)

    const create = async () => {
      if (!name.trim()) return
      setSaving(true)
      await supabase.from('deals').insert({
        prospect_name: name.trim(),
        company: company.trim() || null,
        stage_id: stageId || null,
        tag_ids: selectedTags,
      })
      setSaving(false)
      setNewDealModal(false)
      fetchAll()
    }

    const toggleTag = (id: string) => setSelectedTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

    return (
      <Modal title="New Deal" onClose={() => setNewDealModal(false)}>
        <div className="space-y-3">
          <Input label="Prospect Name *" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Smith" />
          <Input label="Company" value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Acme Agency" />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Stage</label>
            <select value={stageId} onChange={e => setStageId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="">No stage</option>
              {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {tags.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="text-xs px-2 py-1 rounded-full border transition-all font-medium"
                    style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color, color: '#fff', borderColor: tag.color } : { backgroundColor: 'transparent', color: tag.color, borderColor: tag.color + '60' }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={create}
            disabled={!name.trim() || saving}
            className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50 mt-1"
          >
            {saving ? 'Creating…' : 'Create Deal'}
          </button>
        </div>
      </Modal>
    )
  }

  // ── Deal Detail Modal ─────────────────────────────────────────────────────
  const DealDetailModal = ({ dealId }: { dealId: string }) => {
    const deal = deals.find(d => d.id === dealId)
    const [notes, setNotes] = useState<DealNote[]>([])
    const [newNote, setNewNote] = useState('')
    const [editName, setEditName] = useState(deal?.prospect_name || '')
    const [editCompany, setEditCompany] = useState(deal?.company || '')
    const [editStage, setEditStage] = useState(deal?.stage_id || '')
    const [editTags, setEditTags] = useState<string[]>(deal?.tag_ids || [])
    const [saving, setSaving] = useState(false)
    const [editing, setEditing] = useState(false)

    useEffect(() => {
      supabase.from('deal_notes').select('*').eq('deal_id', dealId).order('created_at').then(({ data }) => { if (data) setNotes(data) })
    }, [dealId])

    if (!deal) return null

    const addNote = async () => {
      if (!newNote.trim()) return
      await supabase.from('deal_notes').insert({ deal_id: dealId, note: newNote.trim() })
      setNewNote('')
      const { data } = await supabase.from('deal_notes').select('*').eq('deal_id', dealId).order('created_at')
      if (data) setNotes(data)
    }

    const saveEdits = async () => {
      setSaving(true)
      await supabase.from('deals').update({
        prospect_name: editName.trim(),
        company: editCompany.trim() || null,
        stage_id: editStage || null,
        tag_ids: editTags,
        updated_at: new Date().toISOString()
      }).eq('id', dealId)
      setSaving(false)
      setEditing(false)
      fetchAll()
    }

    const toggleTag = (id: string) => setEditTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    const dealTags = (deal.tag_ids || []).map(id => getTag(id)).filter(Boolean) as Tag[]

    return (
      <Modal title={deal.prospect_name} onClose={() => setDealDetailId(null)}>
        <div className="space-y-4">
          {/* Info */}
          {editing ? (
            <div className="space-y-2">
              <Input label="Name" value={editName} onChange={e => setEditName(e.target.value)} />
              <Input label="Company" value={editCompany} onChange={e => setEditCompany(e.target.value)} />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Stage</label>
                <select value={editStage} onChange={e => setEditStage(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">No stage</option>
                  {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(tag => (
                    <button key={tag.id} onClick={() => toggleTag(tag.id)} className="text-xs px-2 py-1 rounded-full border transition-all font-medium"
                      style={editTags.includes(tag.id) ? { backgroundColor: tag.color, color: '#fff', borderColor: tag.color } : { backgroundColor: 'transparent', color: tag.color, borderColor: tag.color + '60' }}>
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={saveEdits} disabled={saving} className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900">{deal.prospect_name}</div>
                  {deal.company && <div className="text-sm text-gray-500">{deal.company}</div>}
                  <div className="text-xs text-gray-400 mt-0.5">Added {fmtDate(deal.created_at)}</div>
                  {getStage(deal.stage_id) && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStage(deal.stage_id)?.color }} />
                      <span className="text-xs text-gray-600">{getStage(deal.stage_id)?.name}</span>
                    </div>
                  )}
                  {dealTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {dealTags.map(tag => (
                        <span key={tag.id} className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: tag.color + '18', color: tag.color }}>{tag.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
                  <Edit2 size={13} className="text-gray-500" />
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Notes</h4>
            {notes.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No notes yet</p>
            ) : (
              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                {notes.map(n => (
                  <div key={n.id} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{n.note}</p>
                    <p className="text-xs text-gray-400 mt-1">{fmtDatetime(n.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addNote() }}
                placeholder="Add a note… (⌘Enter to save)"
                rows={2}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none transition-all"
              />
              <button onClick={addNote} disabled={!newNote.trim()} className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40">
                <Plus size={15} />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1 border-t border-gray-100">
            <button
              onClick={() => { setDealDetailId(null); setArchiveModal(dealId) }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700 transition-colors"
            >
              <Archive size={14} /> Archive
            </button>
            <button
              onClick={() => setConfirmModal({ msg: `Permanently delete ${deal.prospect_name}?`, fn: () => { setDealDetailId(null); deleteDeal(dealId) } })}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Archive Reason Modal ──────────────────────────────────────────────────
  const ArchiveReasonModal = ({ dealId }: { dealId: string }) => {
    const deal = deals.find(d => d.id === dealId)
    const [reason, setReason] = useState('')
    return (
      <Modal title="Archive Deal" onClose={() => setArchiveModal(null)}>
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            Archiving <strong>{deal?.prospect_name}</strong>. This will remove the deal from the active pipeline.
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why did this deal fall through?"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
            />
          </div>
          <button onClick={() => archiveDeal(dealId, reason)} className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors">
            Archive Deal
          </button>
        </div>
      </Modal>
    )
  }

  // ── Nav ───────────────────────────────────────────────────────────────────
  const navItems = [
    { id: 'data', label: 'Data', icon: <BarChart2 size={18} /> },
    { id: 'input', label: 'Input', icon: <LogIn size={18} /> },
    { id: 'crm', label: 'CRM', icon: <List size={18} /> },
    { id: 'archive', label: 'Archive', icon: <Archive size={18} /> },
    { id: 'goals', label: 'Goals', icon: <Target size={18} /> },
    { id: 'settings', label: 'Setup', icon: <Settings size={18} /> },
  ] as const

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 pt-safe-top sticky top-0 z-30">
        <div className="flex items-center gap-3 py-3">
          {/* Logo */}
          <img src="/logo.png" alt="Gunderson & Partners" className="h-10 w-auto object-contain" />
          <div className="h-6 w-px bg-gray-200" />
          <div>
            <div className="text-xs font-semibold text-gray-900 leading-tight">DM Outreach</div>
            <div className="text-xs text-gray-400 leading-tight">Deal Tracker</div>
          </div>
        </div>
        {/* Tab bar */}
        <div className="flex gap-0 overflow-x-auto scrollbar-none -mx-4 px-4">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 border-b-2 ${tab === item.id ? 'text-gray-900 border-gray-900' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-safe-bottom">
        {tab === 'data' && <DataTab />}
        {tab === 'input' && <InputTab />}
        {tab === 'crm' && <CRMTab />}
        {tab === 'archive' && <ArchiveTab />}
        {tab === 'goals' && <GoalsTab />}
        {tab === 'settings' && <SettingsTab />}
      </main>

      {/* Modals */}
      {newDealModal && <NewDealModal />}
      {dealDetailId && <DealDetailModal dealId={dealDetailId} />}
      {archiveModal && <ArchiveReasonModal dealId={archiveModal} />}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.msg}
          onConfirm={() => { confirmModal.fn(); setConfirmModal(null) }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  )
}
