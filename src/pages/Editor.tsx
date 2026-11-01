import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EditorContent, useEditor, Editor as TipEditor } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { paperExtensions } from '../components/PaperView'
import PaperView from '../components/PaperView'
import ReportPanel from '../components/ReportPanel'
import { countWords, fmtDate, useSettings } from '../lib/utils'

/* eslint-disable @typescript-eslint/no-explicit-any */
const TEMPLATE = ['Abstract', 'Introduction', 'Literature Review', 'Research Methodology', 'Results and Discussion', 'Conclusion', 'References']
  .map((h) => `<h2>${h}</h2><p></p>`).join('')

type SaveState = 'saved' | 'saving' | 'error' | 'dirty'

export default function EditorPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [sub, setSub] = useState<any>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: reg } = await supabase.from('registrations').select('id, status, research_title').eq('user_id', user.id).maybeSingle()
      if (!reg) return nav('/complete-registration', { replace: true })
      if (reg.status !== 'paid') return nav('/payment', { replace: true })
      let { data: s } = await supabase.from('submissions').select('*').eq('user_id', user.id).maybeSingle()
      if (!s) {
        const ins = await supabase.from('submissions')
          .insert({ user_id: user.id, registration_id: reg.id, title: reg.research_title }).select('*').single()
        if (ins.error) { setErr(ins.error.message); return }
        s = ins.data
      }
      setSub(s)
    })()
  }, [user, nav])

  if (err) return <p className="p-10 text-center text-red-600">{err}</p>
  if (!sub) return <p className="p-10 text-center text-slate-500">Loading editor…</p>
  return <EditorInner initial={sub} />
}

function EditorInner({ initial }: { initial: any }) {
  const { user } = useAuth()
  const settings = useSettings()
  const nav = useNavigate()
  const locked: boolean = initial.locked
  const [title, setTitle] = useState<string>(initial.title)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [savedAt, setSavedAt] = useState<string | null>(initial.updated_at)
  const [words, setWords] = useState<number>(initial.word_count)
  const [tab, setTab] = useState<'write' | 'preview' | 'reports' | 'history'>('write')
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState('')
  const [policyOk, setPolicyOk] = useState(() => {
    try { return localStorage.getItem('rda_policy_ok') === '1' } catch { return false }
  })

  const timer = useRef<number>()
  const lastLen = useRef(0)
  const lastKey = useRef(0)
  const activeSecs = useRef(0)

  const logActivity = useCallback(async (event_type: string, char_count: number, meta: Record<string, unknown> = {}) => {
    if (locked) return
    await supabase.from('submission_activity').insert({ submission_id: initial.id, event_type, char_count, meta })
  }, [initial.id, locked])

  const editor = useEditor({
    extensions: [...paperExtensions, Placeholder.configure({ placeholder: 'Start writing your research…' })],
    content: initial.content ?? TEMPLATE,
    editable: !locked,
    editorProps: {
      attributes: { class: 'paper' },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain') ?? ''
        if (text.length > 0) {
          logActivity('paste', text.length, { words: text.trim().split(/\s+/).length, preview: text.slice(0, 80) })
        }
        return false // let TipTap handle the paste normally
      },
      handleKeyDown: () => { lastKey.current = Date.now(); return false },
    },
    onUpdate: ({ editor: ed }) => {
      setSaveState('dirty')
      const len = ed.getText().length
      if (len - lastLen.current > 600) logActivity('large_insert', len - lastLen.current)
      lastLen.current = len
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => save(ed), 2000)
    },
  })

  const save = useCallback(async (ed: TipEditor, t = title) => {
    if (locked) return
    setSaveState('saving')
    const doc = ed.getJSON()
    const wc = countWords(doc)
    const { error } = await supabase.from('submissions').update({ content: doc, word_count: wc, title: t }).eq('id', initial.id)
    if (error) { setSaveState('error'); return }
    setWords(wc); setSaveState('saved'); setSavedAt(new Date().toISOString())
  }, [initial.id, locked, title])

  // initial length + active-time tracking
  useEffect(() => { if (editor) lastLen.current = editor.getText().length }, [editor])
  useEffect(() => {
    if (locked) return
    const tick = window.setInterval(() => {
      if (Date.now() - lastKey.current < 30000) activeSecs.current += 5
    }, 5000)
    const flush = window.setInterval(() => {
      if (activeSecs.current > 0) { logActivity('session', 0, { active_seconds: activeSecs.current }); activeSecs.current = 0 }
    }, 60000)
    return () => { window.clearInterval(tick); window.clearInterval(flush) }
  }, [locked, logActivity])

  // warn on unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (saveState === 'dirty' || saveState === 'saving') e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [saveState])

  const loadReports = useCallback(async () => {
    const { data } = await supabase.from('originality_reports').select('*').eq('submission_id', initial.id).order('created_at', { ascending: false })
    setReports(data ?? [])
  }, [initial.id])
  useEffect(() => { loadReports() }, [loadReports])

  const openTab = async (t: typeof tab) => {
    if (editor && !locked && (t === 'preview' || t === 'reports')) await save(editor)
    if (t === 'preview' && editor) setPreviewDoc(editor.getJSON())
    if (t === 'history') {
      const { data } = await supabase.from('submission_versions').select('*').eq('submission_id', initial.id).order('created_at', { ascending: false })
      setVersions(data ?? [])
    }
    setTab(t)
  }

  const runCheck = async () => {
    if (!editor) return
    setChecking(true); setNote('')
    await save(editor)
    const { data, error } = await supabase.functions.invoke('run-originality', { body: { submission_id: initial.id } })
    if (error || data?.error) setNote(data?.error ?? error?.message ?? 'Check failed')
    await loadReports()
    setChecking(false)
  }

  const restore = async (v: any) => {
    if (!editor || !confirm('Replace the current draft with this version?')) return
    editor.commands.setContent(v.content ?? '')
    await save(editor)
    setTab('write')
  }

  const submitFinal = async () => {
    if (!editor) return
    if (!confirm('Submit your final paper? It will be locked and you will not be able to edit it.')) return
    await save(editor)
    const { error } = await supabase.rpc('submit_paper', { p_submission: initial.id })
    if (error) { setNote(error.message); return }
    nav('/dashboard')
  }

  const uploadImage = async (file: File) => {
    if (!user || !editor) return
    if (file.size > 5 * 1024 * 1024) { setNote('Images must be under 5 MB.'); return }
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('submission-assets').upload(path, file)
    if (error) { setNote(error.message); return }
    const { data } = await supabase.storage.from('submission-assets').createSignedUrl(path, 60 * 60 * 24 * 365)
    if (data?.signedUrl) editor.chain().focus().setImage({ src: data.signedUrl }).run()
  }

  const badge: Record<SaveState, string> = {
    saved: `Saved ${savedAt ? fmtDate(savedAt) : ''}`, saving: 'Saving…', dirty: 'Unsaved changes…', error: '⚠ Save failed — retrying on next edit',
  }

  if (!policyOk && !locked) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="card space-y-3 text-sm">
          <h1 className="font-serif text-2xl font-bold text-royal-800">Before you begin writing</h1>
          <p>To support fair evaluation, the editor records <b>writing activity</b>: paste events, large insertions, time spent editing and your revision history. Your text is also sent to <b>external plagiarism and AI-content detection services</b>.</p>
          <p>This activity record is shown to judges and administrators as context only. Pasting is never treated as proof of plagiarism — you may legitimately paste references, quotations or your own notes.</p>
          <button className="btn-primary" onClick={() => { try { localStorage.setItem('rda_policy_ok', '1') } catch { /* ignore */ } setPolicyOk(true) }}>
            I understand and agree
          </button>
          <Link to="/dashboard" className="ml-3 text-royal-700 underline">Back</Link>
        </div>
      </div>
    )
  }

  const tools: [string, () => void, boolean?][] = editor ? [
    ['B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold')],
    ['I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic')],
    ['H2', () => editor.chain().focus().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 })],
    ['H3', () => editor.chain().focus().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 })],
    ['• List', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList')],
    ['1. List', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList')],
    ['x₂', () => editor.chain().focus().toggleSubscript().run(), editor.isActive('subscript')],
    ['x²', () => editor.chain().focus().toggleSuperscript().run(), editor.isActive('superscript')],
    ['Table', () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()],
    ['+Row', () => editor.chain().focus().addRowAfter().run()],
    ['+Col', () => editor.chain().focus().addColumnAfter().run()],
    ['Undo', () => editor.chain().focus().undo().run()],
    ['Redo', () => editor.chain().focus().redo().run()],
  ] : []

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/dashboard" className="text-sm text-royal-700 underline">← Dashboard</Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500">{words} words</span>
          <span className={`badge ${saveState === 'error' ? 'bg-red-100 text-red-700' : saveState === 'saved' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`} role="status">
            {locked ? 'Submitted — locked' : badge[saveState]}
          </span>
        </div>
      </div>

      <input
        aria-label="Research title" className="input !text-xl font-serif font-bold" value={title} disabled={locked}
        onChange={(e) => { setTitle(e.target.value); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => editor && save(editor, e.target.value), 2000) }}
      />

      <div className="flex gap-1 border-b border-slate-200">
        {(['write', 'preview', 'reports', 'history'] as const).map((t) => (
          <button key={t} onClick={() => openTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize ${tab === t ? 'border-b-2 border-royal-800 text-royal-800' : 'text-slate-500'}`}>
            {t === 'reports' ? 'Originality' : t === 'history' ? 'Version history' : t}
          </button>
        ))}
      </div>

      {note && <p role="alert" className="text-sm text-red-600">{note}</p>}

      <div className={tab === 'write' ? '' : 'hidden'}>
        {!locked && (
          <div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-royal-50 p-2" role="toolbar" aria-label="Formatting">
            {tools.map(([label, fn, active]) => (
              <button key={label} type="button" onClick={fn} className={`rounded px-2 py-1 text-xs font-semibold ${active ? 'bg-royal-800 text-white' : 'bg-white text-royal-800 hover:bg-royal-100'}`}>{label}</button>
            ))}
            <label className="cursor-pointer rounded bg-white px-2 py-1 text-xs font-semibold text-royal-800 hover:bg-royal-100">
              Image
              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = '' }} />
            </label>
          </div>
        )}
        <div className="rounded-lg border border-slate-200 bg-white"><EditorContent editor={editor} /></div>
        <p className="mt-2 text-xs text-slate-500">Mathematical expressions: use the x₂ / x² buttons and Unicode symbols (e.g. ∑, ∫, ≈). A full equation editor is listed under future enhancements.</p>
      </div>

      {tab === 'preview' && <PaperView content={previewDoc} />}

      {tab === 'reports' && (
        <div className="card space-y-4">
          {!locked && <button className="btn-outline" disabled={checking} onClick={runCheck}>{checking ? 'Analysing…' : 'Run originality & AI-content check'}</button>}
          <ReportPanel reports={reports} />
        </div>
      )}

      {tab === 'history' && (
        <div className="card text-sm">
          {versions.length === 0 ? <p className="text-slate-500">No earlier versions yet — snapshots are taken automatically as you write.</p> : (
            <ul className="divide-y">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2">
                  <span>{fmtDate(v.created_at)} · {v.word_count} words</span>
                  {!locked && <button className="btn-outline !py-1" onClick={() => restore(v)}>Restore</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!locked && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Deadline: {fmtDate(settings?.submission_deadline)}. Review the preview and originality tab, then submit. Submission is final and locks the paper.
          </p>
          <button className="btn-gold" onClick={submitFinal} disabled={saveState === 'saving'}>Submit final paper</button>
        </div>
      )}
    </div>
  )
}
