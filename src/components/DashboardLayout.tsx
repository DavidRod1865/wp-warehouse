import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import SidebarNav from "./SidebarNav";
import SettingsModal from "./SettingsModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faGear,
  faPlus,
  faTruck,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";

export default function DashboardLayout() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const onDeliveries = location.pathname.startsWith("/deliveries");
  const onInventory = location.pathname.startsWith("/inventory");
  const onVendors = location.pathname.startsWith("/vendors");
  const onSettings = location.pathname.startsWith("/settings");

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col lg:flex-row">
      <SidebarNav onOpenSettings={() => setIsSettingsOpen(true)} />
      <div className="flex-1 min-w-0">
        <div className="pb-24 lg:pb-0">
          <Outlet />
        </div>
      </div>

      <nav className="lg:hidden fixed bottom-4 left-0 right-0 z-40">
        <div className="mx-auto max-w-lg px-4">
          <div className="relative bg-gray-900/95 backdrop-blur rounded-2xl px-4 py-3 shadow-lg">
            <div className="grid grid-cols-5 items-center">
          <button
            type="button"
            onClick={() => navigate("/inventory")}
            className={`flex flex-col items-center gap-1 text-[20px] ${
              onInventory ? "text-blue-200" : "text-gray-300"
            }`}
          >
            <FontAwesomeIcon icon={faWarehouse} className="h-6 w-6" />
            <span className="sr-only">Warehouse</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/deliveries")}
            className={`flex flex-col items-center gap-1 text-[20px] ${
              onDeliveries ? "text-blue-200" : "text-gray-300"
            }`}
          >
            <FontAwesomeIcon icon={faTruck} className="h-6 w-6" />
            <span className="sr-only">Deliveries</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onDeliveries ? navigate("/deliveries/create") : navigate(
                onInventory
                  ? "/inventory"
                  : onVendors
                  ? "/vendors"
                  : onSettings
                  ? "/settings"
                  : "/deliveries"
              )
            }
            className="flex items-center justify-center"
          >
            <span
              className={`flex items-center justify-center rounded-full h-14 w-14 -mt-6 shadow-lg ${
                onDeliveries ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700"
              }`}
            >
              <FontAwesomeIcon
                icon={
                  onDeliveries
                    ? faPlus
                    : onInventory
                    ? faWarehouse
                    : onVendors
                    ? faBuilding
                    : onSettings
                    ? faGear
                    : faTruck
                }
                className="h-6 w-6"
              />
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/vendors")}
            className={`flex flex-col items-center gap-1 text-[20px] ${
              onVendors ? "text-blue-200" : "text-gray-300"
            }`}
          >
            <FontAwesomeIcon icon={faBuilding} className="h-6 w-6" />
            <span className="sr-only">Vendors</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className={`flex flex-col items-center gap-1 text-[20px] ${
              onSettings ? "text-blue-200" : "text-gray-300"
            }`}
          >
            <FontAwesomeIcon icon={faGear} className="h-6 w-6" />
            <span className="sr-only">Settings</span>
          </button>
            </div>
          </div>
        </div>
      </nav>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenDriverManagement={() => {
          setIsSettingsOpen(false);
          navigate("/drivers");
        }}
      />
    </div>
  );
}
