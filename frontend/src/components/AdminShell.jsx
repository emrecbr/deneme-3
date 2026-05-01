export default function AdminShell({ sidebar, topbar, children }) {
  return (
    <div className="wrapper admin-shell">
      <aside className="main-sidebar sidebar-dark-primary elevation-4 admin-sidebar">{sidebar}</aside>
      <div className="content-wrapper admin-content">
        <header className="main-header navbar navbar-expand navbar-white navbar-light admin-topbar">
          <div className="container-fluid">{topbar}</div>
        </header>
        <main className="content admin-main">
          <div className="container-fluid">{children}</div>
        </main>
      </div>
    </div>
  );
}
