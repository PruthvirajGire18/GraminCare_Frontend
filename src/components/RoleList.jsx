const roles = [
  { number: '01', title: 'ASHA worker', description: 'Community health workers supporting patients in the field.' },
  { number: '02', title: 'Doctor', description: 'Clinicians reviewing cases and making care decisions.' },
  { number: '03', title: 'Administrator', description: 'A small team overseeing access and system operations.' },
]

function RoleList() {
  return (
    <div className="role-list">
      {roles.map((role) => (
        <article className="role-item" key={role.number}>
          <span className="role-number">{role.number}</span>
          <h3>{role.title}</h3>
          <p>{role.description}</p>
        </article>
      ))}
    </div>
  )
}

export default RoleList
