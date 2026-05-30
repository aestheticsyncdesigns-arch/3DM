import { useRef } from 'react'
import type { Category } from '../types'

interface Props {
  categories: Category[]
  activeId: string | null
  onSelect: (id: string) => void
}

export default function CategoryTabs({ categories, activeId, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleClick(id: string) {
    // Scroll the pressed tab into view inside the tab bar
    const tab = scrollRef.current?.querySelector<HTMLButtonElement>(`[data-id="${id}"]`)
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })

    // Page scrolling is handled by the parent via onSelect
    onSelect(id)
  }

  if (categories.length === 0) return null

  return (
    <div className="bg-white shadow-sm">
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto px-3 py-2 no-scrollbar"
      >
        {categories.map((cat) => {
          const isActive = cat.id === activeId
          return (
            <button
              key={cat.id}
              data-id={cat.id}
              onClick={() => handleClick(cat.id)}
              className={[
                'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-b-2 border-[#FF5722] text-[#FF5722]'
                  : 'text-gray-500 hover:text-gray-800',
              ].join(' ')}
            >
              {cat.icon && <span className="text-base leading-none">{cat.icon}</span>}
              {cat.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
