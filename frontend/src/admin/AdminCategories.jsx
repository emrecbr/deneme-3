import MainCategoryImageQuickEditor from './components/MainCategoryImageQuickEditor';

export default function AdminCategories() {
  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Ana Kategoriler</div>
      <div className="admin-panel-body">
        <MainCategoryImageQuickEditor showHeader={false} />
      </div>
    </div>
  );
}
