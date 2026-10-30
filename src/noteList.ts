export type NoteListItem = { checked: boolean; text: string }

export function parseNoteList(content: string): NoteListItem[] {
  if (!content.trim()) return []
  return content.split('\n').map(line => {
    const match = line.match(/^- \[([ xX])\]\s?(.*)$/)
    return match ? { checked: match[1].toLowerCase() === 'x', text: match[2] } : { checked: false, text: line }
  })
}
