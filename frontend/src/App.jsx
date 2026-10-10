import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  const [activePage, setActivePage] = useState('garden')

  const [chatInput, setChatInput] = useState('garden')
  const [chatMessages, setChatMessages] = useState([
    {
      role: 'assitant',
      content: 'Hey! Ask me about anything about your knowledge!',
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
    async function fetchEntries() {
      try {
        setLoading(true)
        setError('')

        const params = new URLSearchParams()

        if (search.trim()) {
          params.append('search', search.trim())
        }

        if (category) {
          params.append('category', category)
        }

        const response = await fetch(
          `http://127.0.0.1:8000/entries?${params.toString()}`
        )

        if (!response.ok) {
          throw new Error('Failed to fetch entries')
        }

        const data = await response.json()
        setEntries(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchEntries()
  }, [search, category])


  async function handleSendMessage(event) {
    event.preventDefault()

    const message = chatInput.trim()
    
    if(!message || chatLoading) {
      return
    }

    setChatMessages((currentMessages) => [
      ...currentMessages,
      {
        role: 'user',
        content: message, 
        usedEntries: [],
      },
    ])

    setChatInput('')
    setChatError('')
    setChatLoading(true)

    try {
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          history: chatMessages
            .slice(-8)
            .map(({ role, content }) => ({ role, content }))
          }),
      })

      if (!response.ok) {
        throw new Error('Failed to get a response from the AI')
      }

      const data = await response.json()

      setChatMessages((currentMessages) => [
        ...currentMessages, 
        {
          role: 'assistant',
          content: data.reply, 
          usedEntries: data.used_entries ?? [],
        },
      ])
  } catch (err) {
    setChatError(err.message)
  }finally {
    setChatLoading(false)
  }
}

  async function handleAddEntry(event){
    event.preventDefault()

    setSaving(true)
    setFormError("")
    
    try {
      const response = await fetch("http://127.0.0.1:8000/entries", {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
        },
        body: JSON.stringify({
          title: newTitle, 
          category: newCategory,
          notes: newNotes,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save entry')
      }

      setNewTitle('')
      setNewCategory('Book')
      setNewNotes('')
      setShowForm(false)

      const params = new URLSearchParams()

      if (search.trim()) {
        params.append('search', search.trim())
      }

      if (category) {
        params.append('category', category)
      }

      const entriesResponse = await fetch(
        `http://127.0.0.1:8000/entries?${params.toString()}`
      )

      if (!entriesResponse.ok) {
        throw new Error('Entry saved, but refreshing the garden failed')
      }

      const data = await entriesResponse.json()
      setEntries(data)

    }catch(err){
      setFormError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteEntry(entryId){
    const confirmed = window.confirm(
      "Are you sure you want to delete this entry?"
    );

    if (!confirmed) {
      return; 
    }

    try { 
      const response = await fetch(
        `http://127.0.0.1:8000/entries/${entryId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete entry");
      }

      setEntries((currentEntries) => 
      currentEntries.filter((entry) => entry.id !== entryId)
    );
    } catch (error) {
      console.error("Erorr deleting entry:", error);
      alert("Couldn't delete this entry. Please try again.");
    }
  }


  function startEditing(entry){
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

  
async function handleSaveEdit(event) {
  event.preventDefault()
  setSavingEdit(true)
  setEditError('')

  try {
    const response = await fetch(
      `http://127.0.0.1:8000/entries/${editingEntry.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle,
          category: editCategory,
          notes: editNotes,
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to update entry')
    }

    const updatedEntry = await response.json()

    setEntries((currentEntries) =>
      currentEntries.map((entry) =>
        entry.id === updatedEntry.id ? updatedEntry : entry
      )
    )

    cancelEditing()
  } catch (error) {
    console.error('Error updating entry:', error)
    setEditError('Could not save changes. Please try again.')
  } finally {
    setSavingEdit(false)
  }
}


  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2 className="logo">🌱 Knowledge Garden</h2>

        <nav>
          <p className="nav-heading">YOUR GARDEN</p>
          <a
            className={`nav-link ${activePage === 'chat' ? 'active' : ''}`}
            href="#chat"
            onClick={(event) => {
              event.preventDefault()
              setActivePage('chat')
              setCategory('')
            }}
          >
           ✨ AI Assitant 
          </a>
          <a
            className={`nav-link ${
              activePage === 'garden' && category === '' ? 'active' : ''
            }`}
            href="#all"
            onClick={(event) => {
              event.preventDefault()
              setActivePage('garden')
              setCategory('')
            }}
          >
            All entries
          </a>

          <a
            className={`nav-link ${category === 'Historical Figure' ? 'active' : ''}`}
            href="#people"
            onClick={(event) => {
              event.preventDefault()
              setActivePage('garden')
              setCategory('Historical Figure')
            }}
          >
            People
          </a>

          <a
            className={`nav-link ${category === 'Book' ? 'active' : ''}`}
            href="#books"
            onClick={(event) => {
              event.preventDefault()
              setActivePage('garden')
              setCategory('Book')
            }}
          >
           Books
          </a>

          <a
            className={`nav-link ${category === 'Movie' ? 'active' : ''}`}
            href="#movies"
            onClick={(event) => {
              event.preventDefault()
              setActivePage('garden')
              setCategory('Movie')
            }}
          >
            Movies
          </a>

          <a
            className={`nav-link ${category === 'Idea' ? 'active' : ''}`}
              href="#ideas"
              onClick={(event) => {
              event.preventDefault()
              setActivePage('garden')
              setCategory('Idea')
            }}
          >
            Ideas
          </a>
        </nav>

        <div className="sidebar-footer">
          Grow your knowledge, one connection at a time.
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <span>My personal space</span>
          <span className="avatar">G</span>
        </header>
        
        {activePage === 'garden' && (
          <>
        <section className="welcome">
          <p className="eyebrow">YOUR SECOND BRAIN</p>
          <h1>Your garden of knowledge.</h1>
          <p className="subtitle">
            Collect the people, stories, and ideas that shape how you see the world.
          </p>
        </section>

        <section className="toolbar">
          <input
            className="search-input"
            type="text"
            placeholder="Search your garden..."
            value={search}
            onChange={(event)=> setSearch(event.target.value)}
          />
          <button 
          className="add-button"
          onClick={() => {
            setFormError('')
            setShowForm(!showForm)
          }}
          >
           {showForm ? 'Cancel' : '+ Add Entry'}
          </button>
        </section>

        {showForm && (
        <form className="entry-form" onSubmit={handleAddEntry}>
          <h2>Plant a new entry 🌱</h2>

          <label htmlFor="entry-title">Title</label>
          <input
            id="entry-title"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="e.g. Siddhartha"
            required
          />

          <label htmlFor="entry-category">Category</label>
          <select
            id="entry-category"
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
          >
            <option value="Historical Figure">Historical Figure</option>
            <option value="Book">Book</option>
            <option value="Movie">Movie</option>
            <option value="Idea">Idea</option>
          </select>

          <label htmlFor="entry-notes">Notes</label>
          <textarea
            id="entry-notes"
            value={newNotes}
            onChange={(event) => setNewNotes(event.target.value)}
            placeholder="What do you want to remember about this?"
            rows={4}
            required
          />

          {formError && <p className="form-error">{formError}</p>}

          <button className="add-button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save entry'}
          </button>
        </form>
      )}


        <section className="entries-section" id="all">
          <div className="section-header">
            <h2>Growing collection</h2>
            <span>{entries.length} entries</span>
          </div>

          {loading && <p>Growing your garden...</p>}

          {error && <p>Couldn't load entries: {error}</p>}

          {!loading && !error && entries.length === 0 && (
            <p>Your garden is empty. Add your first entry soon!</p>
          )}


<div className="entries-grid">
  {entries.map((entry) => (
    <article className="entry-card" key={entry.id}>
      <div className="entry-card-header">
        <span className="category">{entry.category}</span>

        <div className="entry-menu-container">
          <button
            className="menu-button"
            onClick={() =>
              setOpenMenuId(
                openMenuId === entry.id ? null : entry.id
              )
            }
            aria-label="Entry options"
          >
            ⋮
          </button>

          {openMenuId === entry.id && (
            <div className="entry-menu">
              <button
                onClick={() => {
                  startEditing(entry)
                  setOpenMenuId(null)
                }}
              >
                Edit entry
              </button>

              <button
                className="menu-delete-button"
                onClick={() => {
                  setOpenMenuId(null)
                  handleDeleteEntry(entry.id)
                }}
              >
                Delete entry
              </button>
            </div>
          )}
        </div>
      </div>

      <h3>{entry.title}</h3>
      <p>{entry.notes}</p>
      <span className="card-footer">Explore entry ↗</span>

      {editingEntry?.id === entry.id && (
        <form className="entry-form" onSubmit={handleSaveEdit}>
          <label htmlFor={`edit-title-${entry.id}`}>Title</label>
          <input
            id={`edit-title-${entry.id}`}
            value={editTitle}
            onChange={(event) => setEditTitle(event.target.value)}
            required
          />

          <label htmlFor={`edit-category-${entry.id}`}>Category</label>
          <select
            id={`edit-category-${entry.id}`}
            value={editCategory}
            onChange={(event) => setEditCategory(event.target.value)}
            required
          >
            <option value="Person">Person</option>
            <option value="Historical Figure">Historical Figure</option>
            <option value="Book">Book</option>
            <option value="Movie">Movie</option>
            <option value="Idea">Idea</option>
          </select>

          <label htmlFor={`edit-notes-${entry.id}`}>Notes</label>
          <textarea
            id={`edit-notes-${entry.id}`}
            value={editNotes}
            onChange={(event) => setEditNotes(event.target.value)}
            rows={4}
            required
          />

          {editError && <p className="form-error">{editError}</p>}

          <button type="submit" disabled={savingEdit}>
            {savingEdit ? "Saving..." : "Save changes"}
          </button>

          <button type="button" onClick={cancelEditing}>
            Cancel
          </button>
        </form>
      )}
    </article>
  ))}
</div>

        </section>
      </>
        )}
      
{activePage === 'chat' && (
  <section className="chat-page">
    <header className="chat-heading">
      <p className="eyebrow">YOUR PERSONAL AI</p>
      <h1>Knowledge Assistant</h1>
      <p className="subtitle">
        Explore your saved knowledge, ask questions,
        and discover connections between your interests.
      </p>
    </header>

    <div className="chat-messages">
      {chatMessages.map((message, index) => (
        <div
          className={`chat-message ${
            message.role === 'user'
              ? 'user-message'
              : 'assistant-message'
          }`}
          key={index}
        >
          <span className="message-role">
            {message.role === 'user' ? 'You' : 'Knowledge Garden AI'}
          </span>

          <p>{message.content}</p>

          {message.usedEntries?.length > 0 && (
            <div className="used-entries">
              <span className="used-entries-label">
                Based on your saved entries
              </span>

              <div className="used-entry-list">
                {message.usedEntries.map((entry) => (
                  <span className="used-entry-chip" key={entry.id}>
                    {entry.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {chatLoading && (
        <div className="chat-message assistant-message">
          <span className="message-role">Knowledge Garden AI</span>
          <p>Thinking about your garden...</p>
        </div>
      )}

      <div />
    </div>

    {chatError && (
      <p className="form-error">{chatError}</p>
    )}

    <form className="chat-input-form" onSubmit={handleSendMessage}>
      <textarea
        className="chat-input"
        value={chatInput}
        onChange={(event) => setChatInput(event.target.value)}
        placeholder="Ask about your saved knowledge..."
        rows={2}
        disabled={chatLoading}
      />

      <button
        className="add-button chat-send-button"
        type="submit"
        disabled={chatLoading || !chatInput.trim()}
      >
        {chatLoading ? 'Thinking...' : 'Send ↑'}
      </button>
    </form>

    <p className="chat-disclaimer">
      Answers may include general knowledge as well as your saved notes.
    </p>
  </section>
)}

      </main>
    </div>
  )
}

export default App

