import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { PaperLink, TextAlign, Underline } from './PaperFormatting'

export const paperExtensions = [
  StarterKit,
  Image,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Subscript,
  Superscript,
  Underline,
  PaperLink,
  TextAlign,
]

/** Read-only renderer for a paper (used for preview and for judges). Renders through the TipTap schema, never raw HTML. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function PaperView({ content }: { content: any }) {
  const editor = useEditor({ extensions: paperExtensions, content: content ?? '', editable: false })
  useEffect(() => {
    if (editor && content) editor.commands.setContent(content)
  }, [editor, content])
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <EditorContent editor={editor} className="paper" />
    </div>
  )
}
