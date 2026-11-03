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
import {
  Save,
  Send,
  Eye,
  FileDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table as TableIcon,
  Plus,
  Undo2,
  Redo2,
  Image as ImageIcon,
  Link as LinkIcon,
  BookOpen,
  History,
  ShieldAlert,
  X,
  FileCheck2,
  Sparkles
} from 'lucide-react'

/* eslint-disable @typescript-eslint/no-explicit-any */
const TEMPLATE = [
  'Abstract',
  'Introduction',
  'Literature Review',
  'Research Methodology',
  'Results and Discussion',
  'Conclusion',
  'References',
]
  .map((h) => `<h2>${h}</h2><p></p>`)
  .join('')

const pageBreakCount = (doc: any): number =>
  (doc?.content ?? []).reduce(
    (count: number, node: any) => count + (node.type === 'horizontalRule' ? 1 : 0),
    0
  )

type SaveState = 'saved' | 'saving' | 'error' | 'dirty'

export default function EditorPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [sub, setSub] = useState<any>(null)
  const [reg, setReg] = useState<any>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!user) return
    ;(async () => {
      const { data: registration } = await supabase
        .from('registrations')
        .select('id, status, research_title, abstract, research_categories(name)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!registration) return nav('/complete-registration', { replace: true })
      if (registration.status !== 'paid') return nav('/payment', { replace: true })
      setReg(registration)

      let { data: s } = await supabase
        .from('submissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!s) {
        const ins = await supabase
          .from('submissions')
          .insert({
            user_id: user.id,
            registration_id: registration.id,
            title: registration.research_title,
          })
          .select('*')
          .single()

        if (ins.error) {
          setErr(ins.error.message)
          return
        }
        s = ins.data
      }
      setSub(s)
    })()
  }, [user, nav])

  if (err) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl bg-red-50 p-6 text-center border border-red-200">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <h2 className="font-bold text-red-900">Editor Initialization Error</h2>
          <p className="text-sm text-red-700 mt-1">{err}</p>
          <Link to="/dashboard" className="btn-outline mt-4">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  if (!sub || !reg) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-royal-200 border-t-royal-800" />
          <p className="text-sm font-medium text-slate-500">Opening Research Paper Editor…</p>
        </div>
      </div>
    )
  }

  return <EditorInner initial={sub} registration={reg} />
}

function EditorInner({ initial, registration }: { initial: any; registration: any }) {
  const { user, fullName } = useAuth()
  const settings = useSettings()
  const nav = useNavigate()
  const locked: boolean = initial.locked

  const [title, setTitle] = useState<string>(initial.title || registration.research_title)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [savedAt, setSavedAt] = useState<string | null>(initial.updated_at)
  const [words, setWords] = useState<number>(initial.word_count || 0)
  const [manualPages, setManualPages] = useState(() => pageBreakCount(initial.content))
  const [currentPage, setCurrentPage] = useState(1)
  const pages = Math.max(1, Math.ceil(words / 250), manualPages + 1)

  const [tab, setTab] = useState<'write' | 'preview' | 'reports' | 'history'>('write')
  const [previewDoc, setPreviewDoc] = useState<any>(null)
  const [reports, setReports] = useState<any[]>([])
  const [versions, setVersions] = useState<any[]>([])
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState('')
  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [policyOk, setPolicyOk] = useState(() => {
    try {
      return localStorage.getItem('rda_policy_ok') === '1'
    } catch {
      return false
    }
  })

  const timer = useRef<number>()
  const lastLen = useRef(0)
  const lastKey = useRef(0)
  const activeSecs = useRef(0)

  const logActivity = useCallback(
    async (event_type: string, char_count: number, meta: Record<string, unknown> = {}) => {
      if (locked) return
      await supabase
        .from('submission_activity')
        .insert({ submission_id: initial.id, event_type, char_count, meta })
    },
    [initial.id, locked]
  )

  const editor = useEditor({
    extensions: [
      ...paperExtensions,
      Placeholder.configure({
        placeholder: 'Begin writing your research paper here… Use standard academic headings.',
      }),
    ],
    content: initial.content ?? TEMPLATE,
    editable: !locked,
    editorProps: {
      attributes: { class: 'paper focus:outline-none min-h-[600px] text-slate-800' },
      handlePaste: (_view, event) => {
        const text = event.clipboardData?.getData('text/plain') ?? ''
        if (text.length > 0) {
          logActivity('paste', text.length, {
            words: text.trim().split(/\s+/).length,
            preview: text.slice(0, 80),
          })
        }
        return false
      },
      handleKeyDown: () => {
        lastKey.current = Date.now()
        return false
      },
    },
    onUpdate: ({ editor: ed }) => {
      setSaveState('dirty')
      setManualPages(pageBreakCount(ed.getJSON()))
      setWords(countWords(ed.getJSON()))
      const len = ed.getText().length
      if (len - lastLen.current > 600) logActivity('large_insert', len - lastLen.current)
      lastLen.current = len
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => save(ed), 2000)
    },
    onSelectionUpdate: ({ editor: ed }) => {
      const before = ed.state.doc.textBetween(0, ed.state.selection.head, ' ', ' ')
      const positionPage = Math.max(
        1,
        Math.ceil(before.trim().split(/\s+/).filter(Boolean).length / 250)
      )
      setCurrentPage(
        Math.min(
          positionPage,
          Math.max(1, Math.ceil(words / 250), pageBreakCount(ed.getJSON()) + 1)
        )
      )
    },
  })

  const save = useCallback(
    async (ed: TipEditor, t = title) => {
      if (locked) return
      setSaveState('saving')
      const doc = ed.getJSON()
      const wc = countWords(doc)
      const { error } = await supabase
        .from('submissions')
        .update({ content: doc, word_count: wc, title: t, updated_at: new Date().toISOString() })
        .eq('id', initial.id)

      if (error) {
        setSaveState('error')
        return
      }
      setWords(wc)
      setSaveState('saved')
      setSavedAt(new Date().toISOString())
    },
    [initial.id, locked, title]
  )

  // Tracking active writing time
  useEffect(() => {
    if (editor) lastLen.current = editor.getText().length
  }, [editor])

  useEffect(() => {
    if (locked) return
    const tick = window.setInterval(() => {
      if (Date.now() - lastKey.current < 30000) activeSecs.current += 5
    }, 5000)
    const flush = window.setInterval(() => {
      if (activeSecs.current > 0) {
        logActivity('session', 0, { active_seconds: activeSecs.current })
        activeSecs.current = 0
      }
    }, 60000)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(flush)
    }
  }, [locked, logActivity])

  // Warn on unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving') e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [saveState])

  const loadReports = useCallback(async () => {
    const { data } = await supabase
      .from('originality_reports')
      .select('*')
      .eq('submission_id', initial.id)
      .order('created_at', { ascending: false })
    setReports(data ?? [])
  }, [initial.id])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const openTab = async (t: typeof tab) => {
    if (editor && !locked && (t === 'preview' || t === 'reports')) {
      await save(editor)
    }
    if (t === 'preview' && editor) {
      setPreviewDoc(editor.getJSON())
    }
    if (t === 'history') {
      const { data } = await supabase
        .from('submission_versions')
        .select('*')
        .eq('submission_id', initial.id)
        .order('created_at', { ascending: false })
      setVersions(data ?? [])
    }
    setTab(t)
  }

  const runCheck = async () => {
    if (!editor) return
    setChecking(true)
    setNote('')
    await save(editor)
    const { data, error } = await supabase.functions.invoke('run-originality', {
      body: { submission_id: initial.id },
    })
    if (error || data?.error) setNote(data?.error ?? error?.message ?? 'Analysis failed')
    await loadReports()
    setChecking(false)
  }

  const restore = async (v: any) => {
    if (!editor || !confirm('Replace the current draft with this previous snapshot?')) return
    editor.commands.setContent(v.content ?? '')
    await save(editor)
    setTab('write')
  }

  // Final submission action
  const handleFinalSubmit = async () => {
    if (!editor) return
    if (words < 750) {
      setNote(`Your paper is currently ${pages} page(s). You must reach at least 3 pages (750 words minimum) before submitting.`)
      setSubmitModalOpen(false)
      return
    }

    setIsSubmitting(true)
    setNote('')
    await save(editor)
    const { error } = await supabase.rpc('submit_paper', { p_submission: initial.id })
    setIsSubmitting(false)

    if (error) {
      setNote(error.message)
      setSubmitModalOpen(false)
      return
    }

    setSubmitModalOpen(false)
    nav('/dashboard')
  }

  // Academic PDF generation & download
  const downloadPdf = () => {
    if (!editor) return
    const win = window.open('', '_blank')
    if (!win) {
      setNote('Please allow pop-ups to preview and download your paper as a PDF.')
      return
    }

    const htmlContent = editor.getHTML()
    const cleanTitle = title.replace(/[<>]/g, '')
    const authorName = fullName || 'Author'
    const categoryName = registration.research_categories?.name || 'Research Category'

    win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${cleanTitle} — Research Distinction Awards</title>
  <style>
    @page {
      size: A4;
      margin: 25mm 20mm;
      @bottom-right {
        content: counter(page);
      }
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111;
      max-width: 780px;
      margin: 0 auto;
      padding: 30px;
    }
    .header-block {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1.5px solid #061331;
    }
    .awards-badge {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #087fc4;
      font-weight: bold;
      margin-bottom: 8px;
    }
    h1 {
      font-size: 20pt;
      line-height: 1.3;
      margin: 10px 0;
      color: #061331;
    }
    .meta-line {
      font-size: 10pt;
      color: #444;
      margin-top: 6px;
    }
    .abstract-box {
      font-style: italic;
      background: #f9f9f9;
      padding: 12px 18px;
      margin: 20px 0 30px;
      border-left: 3px solid #00c8ef;
      font-size: 10pt;
    }
    .paper-body {
      text-align: justify;
    }
    .paper-body h2 {
      font-size: 13pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 24px;
      margin-bottom: 8px;
      color: #061331;
      border-bottom: 0.5px solid #ccc;
      padding-bottom: 3px;
    }
    .paper-body h3 {
      font-size: 11.5pt;
      margin-top: 16px;
      margin-bottom: 6px;
      color: #222;
    }
    .paper-body p {
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #777;
      padding: 6px 10px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 15px auto;
    }
    hr {
      border: none;
      border-top: 1px dashed #aaa;
      margin: 30px 0;
      page-break-after: always;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="header-block">
    <div class="awards-badge">Research Distinction Awards 2026 · ${categoryName}</div>
    <h1>${cleanTitle}</h1>
    <div class="meta-line"><strong>${authorName}</strong> · ${registration.abstract ? 'Original Research Article' : 'Working Draft'}</div>
  </div>
  ${registration.abstract ? `<div class="abstract-box"><strong>Abstract:</strong> ${registration.abstract}</div>` : ''}
  <div class="paper-body">
    ${htmlContent}
  </div>
  <script>
    window.onload = () => {
      window.print();
    };
  </script>
</body>
</html>`)
    win.document.close()
  }

  const uploadImage = async (file: File) => {
    if (!user || !editor) return
    if (file.size > 5 * 1024 * 1024) {
      setNote('Images must be under 5 MB in file size.')
      return
    }
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`
    const { error } = await supabase.storage.from('submission-assets').upload(path, file)
    if (error) {
      setNote(error.message)
      return
    }
    const { data } = await supabase.storage
      .from('submission-assets')
      .createSignedUrl(path, 60 * 60 * 24 * 365)
    if (data?.signedUrl) {
      editor.chain().focus().setImage({ src: data.signedUrl }).run()
    }
  }

  // Pre-writing policy check
  if (!policyOk && !locked) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-2xl bg-white p-8 shadow-xl border border-slate-200 space-y-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-royal-50 text-royal-800 border border-royal-100">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-royal-600">
              Academic Integrity Agreement
            </span>
            <h1 className="font-serif text-2xl font-bold text-royal-950 mt-1">
              Before You Begin Writing
            </h1>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            To ensure fair and rigorous scholarly evaluation, the platform tracks writing telemetry (such as editing duration and large block insertions) and subjects all final papers to automated <strong>originality &amp; AI-synthesis detection</strong>.
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">
            Pasting quotations, data citations, or literature references is fully permitted. The telemetry serves only as editorial context for the evaluation jury.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              className="btn-primary flex-1"
              onClick={() => {
                try {
                  localStorage.setItem('rda_policy_ok', '1')
                } catch {
                  /* ignore */
                }
                setPolicyOk(true)
              }}
            >
              I Understand &amp; Agree
            </button>
            <Link to="/dashboard" className="btn-outline">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const meetsPageReq = words >= 750

  return (
    <div className="min-h-screen bg-slate-100/70 pb-16">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP UTILITY HEADER / DRAFT STATUS BAR
          ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-[61px] z-40 bg-white border-b border-slate-200/90 shadow-xs">
        <div className="mx-auto max-w-6xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb / Return */}
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-royal-800 hover:text-royal-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Dashboard
            </Link>
            <span className="text-slate-300">|</span>
            {/* Live Autosave Indicator */}
            <div className="flex items-center gap-1.5 text-xs">
              {locked ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                  <FileCheck2 className="w-3.5 h-3.5" /> Final Paper Submitted &amp; Locked
                </span>
              ) : saveState === 'saving' ? (
                <span className="inline-flex items-center gap-1 text-royal-700">
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-royal-700 border-t-transparent" />
                  Saving draft…
                </span>
              ) : saveState === 'error' ? (
                <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" /> Save failed — retrying…
                </span>
              ) : saveState === 'dirty' ? (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <Clock className="w-3.5 h-3.5" /> Unsaved edits…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Saved {savedAt ? fmtDate(savedAt) : ''}
                </span>
              )}
            </div>
          </div>

          {/* Metrics & Page Threshold */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-royal-950">
                {words.toLocaleString()} <span className="font-sans font-normal text-slate-500">words</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-mono font-bold text-royal-950">
                Page {Math.min(currentPage, pages)} of {pages}
              </span>
            </div>

            {/* Minimum 3-Page Enforcement Indicator */}
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                meetsPageReq
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {meetsPageReq ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  3-Page Min Met (≥750 words)
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Min 3 Pages Required ({words}/750 wds)
                </>
              )}
            </span>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadPdf}
                title="Download / Print as PDF"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Download PDF</span>
              </button>

              {!locked && (
                <>
                  <button
                    type="button"
                    onClick={() => editor && save(editor)}
                    disabled={saveState === 'saving'}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-white hover:bg-slate-50 text-royal-800 border border-royal-200 shadow-2xs transition-all disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Draft
                  </button>

                  <button
                    type="button"
                    onClick={() => setSubmitModalOpen(true)}
                    disabled={!meetsPageReq}
                    title={!meetsPageReq ? 'Must be at least 3 pages (750 words) to submit' : ''}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#00c8ef] hover:bg-[#83eaff] text-royal-950 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit Paper
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        {/* Alerts / Error notices */}
        {note && (
          <div
            role="alert"
            className="flex items-center justify-between rounded-xl bg-red-50 p-4 border border-red-200 text-xs text-red-800"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{note}</span>
            </div>
            <button onClick={() => setNote('')} className="p-1 text-red-400 hover:text-red-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            2. PAPER TITLE INPUT (ACADEMIC FORMATTING)
            ───────────────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white p-5 sm:p-6 shadow-sm border border-slate-200/80">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Research Manuscript Title
          </label>
          <input
            aria-label="Research Title"
            value={title}
            disabled={locked}
            onChange={(e) => {
              setTitle(e.target.value)
              window.clearTimeout(timer.current)
              timer.current = window.setTimeout(() => editor && save(editor, e.target.value), 2000)
            }}
            placeholder="Enter full descriptive research title…"
            className="w-full font-serif text-xl sm:text-2xl font-bold text-royal-950 placeholder:text-slate-300 focus:outline-none border-b border-transparent focus:border-royal-600 pb-1 transition-colors"
          />
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
            <span>Author: <strong>{fullName}</strong></span>
            <span>•</span>
            <span>Category: <strong>{registration.research_categories?.name}</strong></span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. TAB NAVIGATION (WRITE | PREVIEW | ORIGINALITY | VERSIONS)
            ───────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
          <div className="flex gap-2">
            {[
              { id: 'write', label: 'Write & Edit', icon: BookOpen },
              { id: 'preview', label: 'Preview Document', icon: Eye },
              { id: 'reports', label: 'Originality & AI', icon: ShieldAlert },
              { id: 'history', label: 'Version Snapshots', icon: History },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => openTab(id as any)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-all ${
                  tab === id
                    ? 'bg-white text-royal-900 border-t-2 border-royal-800 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 hidden sm:block">
            Estimated Pages: <strong>{pages}</strong> (Min 3 required)
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            TAB 1: WRITE (FULL-FEATURED RICH TEXT EDITOR)
            ───────────────────────────────────────────────────────────── */}
        {tab === 'write' && (
          <div className="space-y-3">
            {/* Rich Text Toolbar */}
            {!locked && editor && (
              <div
                role="toolbar"
                aria-label="Editor formatting tools"
                className="sticky top-[108px] z-30 flex flex-wrap items-center gap-1 rounded-xl bg-white p-2 shadow-sm border border-slate-200/90 text-xs"
              >
                {/* Text Styling */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={`p-2 rounded-lg font-bold ${
                    editor.isActive('bold') ? 'bg-royal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Bold (Ctrl+B)"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={`p-2 rounded-lg ${
                    editor.isActive('italic') ? 'bg-royal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Italic (Ctrl+I)"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleMark('underline').run()}
                  className={`p-2 rounded-lg ${
                    editor.isActive('underline') ? 'bg-royal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Underline (Ctrl+U)"
                >
                  <UnderlineIcon className="w-4 h-4" />
                </button>

                <div className="h-5 w-px bg-slate-200 mx-1" />

                {/* Headings */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 ${
                    editor.isActive('heading', { level: 2 })
                      ? 'bg-royal-800 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Heading 2 (Major Section)"
                >
                  <Heading2 className="w-4 h-4" />
                  <span>H2</span>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 ${
                    editor.isActive('heading', { level: 3 })
                      ? 'bg-royal-800 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Heading 3 (Sub-section)"
                >
                  <Heading3 className="w-4 h-4" />
                  <span>H3</span>
                </button>

                <div className="h-5 w-px bg-slate-200 mx-1" />

                {/* Alignment */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().updateAttributes('paragraph', { textAlign: 'left' }).run()}
                  className={`p-2 rounded-lg ${
                    editor.isActive('paragraph', { textAlign: 'left' })
                      ? 'bg-royal-800 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Align Left"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().updateAttributes('paragraph', { textAlign: 'center' }).run()}
                  className={`p-2 rounded-lg ${
                    editor.isActive('paragraph', { textAlign: 'center' })
                      ? 'bg-royal-800 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Align Center"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().updateAttributes('paragraph', { textAlign: 'right' }).run()}
                  className={`p-2 rounded-lg ${
                    editor.isActive('paragraph', { textAlign: 'right' })
                      ? 'bg-royal-800 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Align Right"
                >
                  <AlignRight className="w-4 h-4" />
                </button>

                <div className="h-5 w-px bg-slate-200 mx-1" />

                {/* Lists */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={`p-2 rounded-lg ${
                    editor.isActive('bulletList') ? 'bg-royal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Bullet List"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={`p-2 rounded-lg ${
                    editor.isActive('orderedList') ? 'bg-royal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Numbered List"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>

                {/* Sub/Superscript */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleSubscript().run()}
                  className={`px-2 py-1 rounded-lg font-mono text-xs font-bold ${
                    editor.isActive('subscript') ? 'bg-royal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Subscript (x₂)"
                >
                  x₂
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleSuperscript().run()}
                  className={`px-2 py-1 rounded-lg font-mono text-xs font-bold ${
                    editor.isActive('superscript') ? 'bg-royal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Superscript (x²)"
                >
                  x²
                </button>

                <div className="h-5 w-px bg-slate-200 mx-1" />

                {/* Table Insert & Control */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                  className="px-2 py-1 rounded-lg text-slate-700 hover:bg-slate-100 font-medium flex items-center gap-1"
                  title="Insert 3x3 Table"
                >
                  <TableIcon className="w-4 h-4" />
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addRowAfter().run()}
                  className="px-2 py-1 rounded-lg text-slate-700 hover:bg-slate-100 font-medium"
                  title="Add Row Below"
                >
                  +Row
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().addColumnAfter().run()}
                  className="px-2 py-1 rounded-lg text-slate-700 hover:bg-slate-100 font-medium"
                  title="Add Column Right"
                >
                  +Col
                </button>

                <div className="h-5 w-px bg-slate-200 mx-1" />

                {/* Page Break */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().setHorizontalRule().run()}
                  className="px-2.5 py-1.5 rounded-lg bg-royal-50 text-royal-800 hover:bg-royal-100 font-semibold flex items-center gap-1 border border-royal-200"
                  title="Insert Page Break"
                >
                  <span>Insert Page Break</span>
                </button>

                {/* Link */}
                <button
                  type="button"
                  onClick={() => {
                    const href = window.prompt('Enter link URL (https://…)')
                    if (href && /^https?:\/\//i.test(href)) {
                      editor.chain().focus().setMark('link', { href }).run()
                    }
                  }}
                  className={`p-2 rounded-lg ${
                    editor.isActive('link') ? 'bg-royal-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                  title="Insert Link"
                >
                  <LinkIcon className="w-4 h-4" />
                </button>

                {/* Image Upload */}
                <label className="cursor-pointer p-2 rounded-lg text-slate-700 hover:bg-slate-100" title="Upload Figure / Image (max 5MB)">
                  <ImageIcon className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadImage(f)
                      e.target.value = ''
                    }}
                  />
                </label>

                <div className="h-5 w-px bg-slate-200 mx-1 ml-auto" />

                {/* Undo / Redo */}
                <button
                  type="button"
                  onClick={() => editor.chain().focus().undo().run()}
                  className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => editor.chain().focus().redo().run()}
                  className="p-2 rounded-lg text-slate-700 hover:bg-slate-100"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Academic Paper Sheet Simulation */}
            <div className="relative mx-auto rounded-2xl bg-white p-8 sm:p-14 shadow-md border border-slate-200 min-h-[750px]">
              {/* Document Header (Read-only banner inside canvas) */}
              <div className="text-center pb-6 mb-8 border-b border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#087fc4]">
                  Research Distinction Awards 2026 · {registration.research_categories?.name}
                </span>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-royal-950 mt-2 mb-1">
                  {title || 'Untitled Research Manuscript'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  {fullName} · {registration.abstract ? 'Original Submission' : 'Draft Manuscript'}
                </p>
              </div>

              {/* Editor Content Area */}
              <EditorContent editor={editor} />

              {/* Footer of the Paper Sheet */}
              <div className="mt-12 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>Research Distinction Awards · Official Template</span>
                <span>Page {Math.min(currentPage, pages)} of {pages}</span>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            {!locked && (
              <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-royal-900">
                    Submission Requirement: Minimum 3 Pages (750 words)
                  </p>
                  <p className="text-xs text-slate-500">
                    Currently: <strong>{words} words</strong> (~{pages} pages). Once submitted, the paper is locked for jury review.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => editor && save(editor)}
                    disabled={saveState === 'saving'}
                    className="btn-outline !py-2.5"
                  >
                    <Save className="w-4 h-4" />
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubmitModalOpen(true)}
                    disabled={!meetsPageReq}
                    className="btn-gold !py-2.5 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                    Submit Final Paper
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 2: PREVIEW RESEARCH PAPER
            ───────────────────────────────────────────────────────────── */}
        {tab === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-600">
                This is how the jury and committee will view your paper during evaluation.
              </span>
              <button onClick={downloadPdf} className="btn-outline !py-1.5">
                <FileDown className="w-4 h-4" /> Download as PDF
              </button>
            </div>
            <div className="rounded-2xl bg-white p-8 sm:p-14 shadow-md border border-slate-200">
              <div className="text-center pb-6 mb-8 border-b border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#087fc4]">
                  Research Distinction Awards 2026 · {registration.research_categories?.name}
                </span>
                <h1 className="font-serif text-3xl font-bold text-royal-950 mt-2 mb-2">
                  {title}
                </h1>
                <p className="text-xs text-slate-500">
                  Author: <strong>{fullName}</strong>
                </p>
              </div>

              {registration.abstract && (
                <div className="mb-8 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs leading-relaxed text-slate-700 italic">
                  <strong className="not-italic text-royal-900 font-bold block mb-1">Abstract:</strong>
                  {registration.abstract}
                </div>
              )}

              <PaperView content={previewDoc || initial.content} />
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 3: ORIGINALITY & AI CONTENT REPORTS
            ───────────────────────────────────────────────────────────── */}
        {tab === 'reports' && (
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-serif text-lg font-bold text-royal-950">
                  Originality &amp; Plagiarism Analysis
                </h2>
                <p className="text-xs text-slate-500">
                  Automated checks run on your paper to identify citation coverage and AI generation markers
                </p>
              </div>
              {!locked && (
                <button
                  type="button"
                  disabled={checking}
                  onClick={runCheck}
                  className="btn-outline !py-2"
                >
                  {checking ? 'Analyzing…' : 'Run Originality Check'}
                </button>
              )}
            </div>

            <ReportPanel reports={reports} />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            TAB 4: VERSION HISTORY & SNAPSHOTS
            ───────────────────────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="font-serif text-lg font-bold text-royal-950">
                Version History &amp; Snapshots
              </h2>
              <p className="text-xs text-slate-500">
                Automatic snapshots are saved periodically as you edit. You can restore an earlier version at any time.
              </p>
            </div>

            {versions.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No previous snapshots yet — versions are captured automatically during writing sessions.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {versions.map((v) => (
                  <li key={v.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-royal-900">{fmtDate(v.created_at)}</p>
                      <p className="text-slate-500 font-mono text-[11px]">{v.word_count} words (~{Math.ceil(v.word_count / 250)} pages)</p>
                    </div>
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => restore(v)}
                        className="btn-outline !py-1 !text-xs"
                      >
                        Restore This Version
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          SUBMISSION CONFIRMATION MODAL
          ───────────────────────────────────────────────────────────── */}
      {submitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-100 text-royal-900 border border-gold-300">
              <Send className="w-6 h-6 text-royal-800" />
            </div>

            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-royal-600">Final Step</span>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-royal-950 mt-1">
                Confirm Final Paper Submission
              </h2>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Please review your submission details. Once submitted, your research paper will be <strong>permanently locked</strong> for review by the academic editorial board and jury.
            </p>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Paper Title:</span>
                <span className="font-bold text-royal-900 truncate max-w-[220px]">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Word Count:</span>
                <span className="font-mono font-bold text-royal-900">{words} words</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Estimated Pages:</span>
                <span className="font-mono font-bold text-royal-900">{pages} pages (Min: 3 pages)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Page Requirement:</span>
                <span className="font-bold text-emerald-700">✓ Satisfied (≥750 words)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Registration Fee:</span>
                <span className="font-bold text-emerald-700">✓ Paid</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleFinalSubmit}
                className="btn-gold flex-1 !py-3"
              >
                {isSubmitting ? 'Locking & Submitting…' : 'Yes, Submit My Final Paper'}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSubmitModalOpen(false)}
                className="btn-outline !py-3"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
