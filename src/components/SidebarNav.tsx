import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faGear,
  faTruck,
  faUser,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import { useLocation, useNavigate } from "react-router-dom";

export default function SidebarNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="w-full lg:w-72 shrink-0 bg-gray-50 border-r border-gray-200 p-4 h-full">
      <div className="h-full flex flex-col">
        <nav className="space-y-1 flex-1">
          <button
            onClick={() => navigate("/inventory")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
              location.pathname.startsWith("/inventory")
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-700 hover:bg-white hover:text-gray-900"
            }`}
          >
            <FontAwesomeIcon
              icon={faWarehouse}
              className="h-4 w-4 text-gray-500"
            />
            Warehouse Inventory
          </button>

          <div>
            <button
              onClick={() => navigate("/deliveries")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                location.pathname.startsWith("/deliveries") ||
                location.pathname.startsWith("/activity-log")
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-700 hover:bg-white hover:text-gray-900"
              }`}
            >
              <FontAwesomeIcon
                icon={faTruck}
                className="h-4 w-4 text-gray-500"
              />
              Deliveries
            </button>
            <div className="mt-1 ml-6 border-l border-gray-200 pl-3 space-y-1">
              <button
                onClick={() => navigate("/deliveries/create")}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  location.pathname === "/deliveries/create"
                    ? "bg-white text-gray-900 font-medium shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                Create Delivery
              </button>
              <button
                onClick={() => navigate("/activity-log")}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  location.pathname.startsWith("/activity-log")
                    ? "bg-white text-gray-900 font-medium shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                Activity Log
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate("/vendors")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
              location.pathname.startsWith("/vendors")
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-700 hover:bg-white hover:text-gray-900"
            }`}
          >
            <FontAwesomeIcon
              icon={faBuilding}
              className="h-4 w-4 text-gray-500"
            />
            Vendors
          </button>
          <button
            onClick={() => navigate("/drivers")}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
              location.pathname.startsWith("/drivers")
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-700 hover:bg-white hover:text-gray-900"
            }`}
          >
            <FontAwesomeIcon
              icon={faUser}
              className="h-4 w-4 text-gray-500"
            />
            Driver Management
          </button>
        </nav>

        <div className="pt-3 border-t border-gray-200">
          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-700 hover:bg-white hover:text-gray-900 transition-colors"
          >
            <FontAwesomeIcon icon={faGear} className="h-4 w-4 text-gray-500" />
            Settings
          </button>
        </div>
      </div>
    </aside>
  );
}
