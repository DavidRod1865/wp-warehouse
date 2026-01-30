import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBuilding,
  faGear,
  faRightFromBracket,
  faTruck,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type SidebarNavProps = {
  onOpenSettings: () => void;
};

export default function SidebarNav({ onOpenSettings }: SidebarNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const handleNavigate = (path: string) => {
    navigate(path);
  };
  const handleSignOut = () => {
    signOut();
  };

  return (
    <>
      <aside className="hidden lg:flex lg:flex-col lg:w-72 lg:shrink-0 bg-gray-50 border-r border-gray-200 p-4 lg:min-h-screen">
      <div className="flex flex-col flex-1 min-h-0">
        <nav className="space-y-1 flex-1">
          <button
            onClick={() => handleNavigate("/inventory")}
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
              onClick={() => handleNavigate("/deliveries")}
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
                onClick={() => handleNavigate("/deliveries/create")}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  location.pathname === "/deliveries/create"
                    ? "bg-white text-gray-900 font-medium shadow-sm"
                    : "text-gray-600 hover:bg-white hover:text-gray-900"
                }`}
              >
                Create Delivery
              </button>
              <button
                onClick={() => handleNavigate("/activity-log")}
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
            onClick={() => handleNavigate("/vendors")}
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
        </nav>

        <div className="pt-3 border-t border-gray-200 mt-auto">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-700 hover:bg-white hover:text-gray-900 transition-colors"
            >
              <FontAwesomeIcon icon={faGear} className="h-4 w-4 text-gray-500" />
              Settings
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-3 text-gray-700 hover:bg-white hover:text-gray-900 transition-colors"
            >
              <FontAwesomeIcon
                icon={faRightFromBracket}
                className="h-4 w-4 text-gray-500"
              />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
