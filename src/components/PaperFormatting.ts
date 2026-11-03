import { Extension, Mark } from '@tiptap/core'

export const Underline = Mark.create({
  name: 'underline',
  parseHTML() { return [{ tag: 'u' }, { style: 'text-decoration=underline' }] },
  renderHTML({ HTMLAttributes }) { return ['u', HTMLAttributes, 0] },
})

export const PaperLink = Mark.create({
  name: 'link',
  inclusive: false,
  addAttributes() { return { href: { default: null }, target: { default: '_blank' }, rel: { default: 'noopener noreferrer' } } },
  parseHTML() { return [{ tag: 'a[href]', getAttrs: (element) => {
    const href = (element as HTMLElement).getAttribute('href') ?? ''
    return /^(https?:|mailto:)/i.test(href) ? null : false
  } }] },
  renderHTML({ HTMLAttributes }) {
    const href = String(HTMLAttributes.href ?? '')
    return ['a', { ...HTMLAttributes, href: /^(https?:|mailto:)/i.test(href) ? href : '#', class: 'text-blue-700 underline' }, 0]
  },
})

export const TextAlign = Extension.create({
  name: 'textAlign',
  addGlobalAttributes() {
    return [{ types: ['paragraph', 'heading'], attributes: {
      textAlign: {
        default: 'left',
        parseHTML: (element) => element.style.textAlign || 'left',
        renderHTML: (attributes) => ({ style: `text-align: ${attributes.textAlign}` }),
      },
    } }]
  },
})
