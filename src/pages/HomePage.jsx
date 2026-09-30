import RoleList from '../components/RoleList.jsx'

function HomePage() {
  return (
    <main className="content-width">
      <section className="hero" aria-labelledby="home-title">
        <div>
          <p className="eyebrow"><span className="eyebrow-dot" /> Care beyond the signal</p>
          <h1 id="home-title">Care continues, even when the <span>signal doesn't.</span></h1>
          <p className="hero-copy">
            FieldSync is being built for rural care teams working across connected and low-connectivity settings.
          </p>
          <a className="primary-link" href="#roles-title">Meet the care team <span aria-hidden="true">&#8594;</span></a>
        </div>
        <aside className="field-note" aria-label="Project principle">
          <span className="note-label">FIELDNOTE / 001</span>
          <p className="note-title">Local care. Thoughtful connection.</p>
          <p className="note-copy">A foundation for community health workers, doctors, and administrators.</p>
        </aside>
      </section>

      <section className="roles-section" aria-labelledby="roles-title">
        <div className="section-heading">
          <h2 id="roles-title">Made for the care team</h2>
          <p>One shared purpose, with clear responsibilities for each of the three project roles.</p>
        </div>
        <RoleList />
      </section>
    </main>
  )
}

export default HomePage
