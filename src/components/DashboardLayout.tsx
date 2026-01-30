import { Outlet } from "react-router-dom";
import SidebarNav from "./SidebarNav";

export default function DashboardLayout() {
  return (
    <div className="h-screen bg-gray-100 flex flex-col lg:flex-row">
      <SidebarNav />
      <div className="flex-1 min-w-0 h-full overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
