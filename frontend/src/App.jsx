import { useEffect, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'knowledge-garden-entries'

function getSavedEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function filterEntries(entries, search, category) {
  const query = search.trim().toLowerCase()

  return entries.filter((entry) => {
    const matchesSearch =
      !query ||
      entry.title.toLowerCase().includes(query) ||
      entry.notes.toLowerCase().includes(query)

    const matchesCategory = !category || entry.category === category

    return matchesSearch && matchesCategory
  })
}

function App() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [activePage, setActivePage] = useState('garden')

  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assistant',
      content: 'Hey! Ask me about anything in your knowledge garden!',
      usedEntries: [],
    },
  ])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCategory, setNewCategory] = useState('Book')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [editingEntry, setEditingEntry] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState('Book')
  const [editNotes, setEditNotes] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [openMenuId, setOpenMenuId] = useState(null)

  useEffect(() => {
    try {
      setLoading(true)
      setError('')
      setEntries(filterEntries(getSavedEntries(), search, category))
    } catch {
      setError('Could not load your saved entries.')
    } finally {
      setLoading(false)
    }
  }, [search, category])

  function handleAddEntry(event) {
    event.preventDefault()
    setSaving(true)
    setFormError('')

    try {
      const savedEntries = getSavedEntries()

      const newEntry = {
        id: Date.now(),
        title: newTitle.trim(),
        category: newCategory,
        notes: newNotes.trim(),
      }

      const updatedEntries = [...savedEntries, newEntry]
      saveEntries(updatedEntries)
      setEntries(filterEntries(updatedEntries, search, category))

      setNewTitle('')
      setNewCategory('Book')
      setNewNotes('')
      setShowForm(false)
    } catch {
      setFormError('Could not save entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleDeleteEntry(entryId) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this entry?'
    )

    if (!confirmed) return

    try {
      const savedEntries = getSavedEntries()
      const updatedEntries = savedEntries.filter(
        (entry) => entry.id !== entryId
      )

      saveEntries(updatedEntries)
      setEntries(filterEntries(updatedEntries, search, category))
    } catch {
      alert('Could not delete entry. Please try again.')
    }
  }

  function startEditing(entry) {
    setEditingEntry(entry)
    setEditTitle(entry.title)
    setEditCategory(entry.category)
    setEditNotes(entry.notes)
    setEditError('')
  }

  function cancelEditing() {
    setEditingEntry(null)
    setEditTitle('')
    setEditCategory('Book')
    setEditNotes('')
    setEditError('')
  }

  function handleSaveEdit(event) {
    event.preventDefault()
    setSavingEdit(true)
    setEditError('')

    try {
      const savedEntries = getSavedEntries()

      const updatedEntries = savedEntries.map((entry) =>
        entry.id === editingEntry.id
          ? {
              ...entry,
              title: editTitle.trim(),
              category: editCategory,
              notes: editNotes.trim(),
            }
          : entry
      )

      saveEntries(updatedEntries)
      setEntries(filterEntries(updatedEntries, search, category))
      cancelEditing()
    } catch {
      setEditError('Could not save changes. Please try again.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()

    const message = chatInput.trim()
    if (!message || chatLoading) return

    const history = chatMessages
      .filter((item) => item.role === 'user' || item.role === 'assistant')
      .slice(-8)
      .map(({ role, content }) => ({ role, content }))

    const savedEntries = getSavedEntries()
    const queryWords = message.toLowerCase().split(/\W+/).filter(Boolean)

    const relevantEntries = savedEntries
      .map((entry) => {
        const text = `${entry.title} ${entry.category} ${entry.notes}`.toLowerCase()
        const score = queryWords.reduce(
          (total, word) => total + (text.includes(word) ? 1 : 0),
          0
        )
        return { entry, score }
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((item) => item.entry)

    setChatMessages((current) => [
      ...current,
      { role: 'user', content: message, usedEntries: [] },
    ])
    setChatInput('')
    setChatError('')
    setChatLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          entries: relevantEntries,
        }),
      })

      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? 'The chat API is not set up yet. Your saved entries still work.'
            : 'Could not get a response from the AI. Check your API setup.'
        )
      }

      const data = await response.json()

      setChatMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: data.reply,
          usedEntries: data.used_entries ?? relevantEntries,
        },
      ])
    } catch (err) {
      setChatError(err.message || 'Something went wrong.')
    } finally {
      setChatLoading(false)
    }
  }

  const categories = [
    'Book',
    'Person',
    'Movie',
    'Show',
    'Game',
    'Idea',
    'Other',
  ]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <span className="logo-icon">🌱</span>
          <span>Knowledge Garden</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={activePage === 'garden' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActivePage('garden')}
          >
            <span>🌿</span> My Garden
          </button>
          <button
            className={activePage === 'chat' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActivePage('chat')}
          >
            <span>💬</span> Ask Your Garden
          </button>
        </nav>

        <div className="sidebar-bottom">
          <p>Your personal space for ideas, knowledge, and connections.</p>
        </div>
      </aside>

      <main className="main-content">
        {activePage === 'garden' ? (
          <>
            <header className="page-header">
              <div>
                <p className="eyebrow">YOUR PERSONAL KNOWLEDGE BASE</p>
                <h1>My Garden</h1>
                <p className="page-subtitle">
                  Collect the things you learn and love.
                </p>
              </div>

              <button
                className="primary-button"
                onClick={() => {
                  setShowForm(!showForm)
                  setFormError('')
                }}
              >
                {showForm ? 'Cancel' : '+ Add Entry'}
              </button>
            </header>

            {showForm && (
              <form className="entry-form" onSubmit={handleAddEntry}>
                <h2>Plant a new idea</h2>

                <label htmlFor="new-title">Title</label>
                <input
                  id="new-title"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="e.g. 1984, Ali ibn Abu Talib"
                  required
                />

                <label htmlFor="new-category">Category</label>
                <select
                  id="new-category"
                  value={newCategory}
                  onChange={(event) => setNewCategory(event.target.value)}
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>

                <label htmlFor="new-notes">Notes</label>
                <textarea
                  id="new-notes"
                  value={newNotes}
                  onChange={(event) => setNewNotes(event.target.value)}
                  placeholder="What do you want to remember about this?"
                  rows={4}
                  required
                />

                {formError && <p className="error-message">{formError}</p>}

                <button className="primary-button" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Entry'}
                </button>
              </form>
            )}

            <div className="toolbar">
              <input
                className="search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search your garden..."
                aria-label="Search entries"
              />

              <select
                className="category-filter"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="error-message">{error}</p>}

            {loading ? (
              <p className="empty-state">Loading your garden...</p>
            ) : entries.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🌱</div>
                <h2>Your garden is waiting to grow</h2>
                <p>
                  Add your first entry, or try a different search.
                </p>
                {!showForm && (
                  <button
                    className="primary-button"
                    onClick={() => setShowForm(true)}
                  >
                    + Add Your First Entry
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="entry-count">
                  {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                </p>

                <div className="entries-grid">
                  {entries.map((entry) => (
                    <article className="entry-card" key={entry.id}>
                      {editingEntry?.id === entry.id ? (
                        <form
                          className="edit-form"
                          onSubmit={handleSaveEdit}
                        >
                          <label>Title</label>
                          <input
                            value={editTitle}
                            onChange={(event) =>
                              setEditTitle(event.target.value)
                            }
                            required
                          />

                          <label>Category</label>
                          <select
                            value={editCategory}
                            onChange={(event) =>
                              setEditCategory(event.target.value)
                            }
                          >
                            {categories.map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>

                          <label>Notes</label>
                          <textarea
                            value={editNotes}
                            onChange={(event) =>
                              setEditNotes(event.target.value)
                            }
                            rows={4}
                            required
                          />

                          {editError && (
                            <p className="error-message">{editError}</p>
                          )}

                          <div className="card-actions">
                            <button
                              className="primary-button"
                              disabled={savingEdit}
                            >
                              {savingEdit ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={cancelEditing}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="entry-card-header">
                            <span className="category-tag">
                              {entry.category}
                            </span>
                            <button
                              className="menu-button"
                              aria-label={`Options for ${entry.title}`}
                              onClick={() =>
                                setOpenMenuId(
                                  openMenuId === entry.id ? null : entry.id
                                )
                              }
                            >
                              ⋯
                            </button>
                            {openMenuId === entry.id && (
                              <div className="entry-menu">
                                <button
                                  onClick={() => {
                                    startEditing(entry)
                                    setOpenMenuId(null)
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    handleDeleteEntry(entry.id)
                                    setOpenMenuId(null)
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>

                          <h2>{entry.title}</h2>
                          <p className="entry-notes">{entry.notes}</p>
                        </>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <section className="chat-page">
            <header className="page-header">
              <div>
                <p className="eyebrow">YOUR PERSONAL KNOWLEDGE ASSISTANT</p>
                <h1>Ask Your Garden</h1>
                <p className="page-subtitle">
                  Ask questions about the knowledge you've saved.
                </p>
              </div>
            </header>

            <div className="chat-panel">
              <div className="chat-messages">
                {chatMessages.map((message, index) => (
                  <div
                    className={`chat-message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                    key={`${message.role}-${index}`}
                  >
                    <div className="message-role">
                      {message.role === 'user' ? 'You' : 'Garden Assistant'}
                    </div>
                    <p>{message.content}</p>

                    {message.usedEntries?.length > 0 && (
                      <div className="used-entries">
                        <span>Based on your entries:</span>
                        {message.usedEntries.map((entry) => (
                          <span className="used-entry-tag" key={entry.id}>
                            {entry.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {chatLoading && (
                  <div className="chat-message assistant-message">
                    <p>Thinking about your garden...</p>
                  </div>
                )}
              </div>

              {chatError && <p className="error-message">{chatError}</p>}

              <form className="chat-form" onSubmit={handleSendMessage}>
                <input
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ask about something you've saved..."
                  aria-label="Message"
                  disabled={chatLoading}
                />
                <button
                  className="primary-button"
                  disabled={chatLoading || !chatInput.trim()}
                >
                  {chatLoading ? 'Thinking...' : 'Send'}
                </button>
              </form>

              <p className="chat-disclaimer">
                The assistant uses matching entries from your garden as context.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
