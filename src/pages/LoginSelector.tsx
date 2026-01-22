import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWarehouse, faTruck } from '@fortawesome/free-solid-svg-icons';
import warehouseBackground from '../assets/Expansive Warehouse Interior.png';

export default function LoginSelector() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url(${warehouseBackground})` }}
    >
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 text-center">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">With Pride HVAC</h1>
          <p className="text-white mt-2">Select your portal to login</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          {/* Warehouse Card */}
          <button
            onClick={() => navigate('/login')}
            className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl p-8 w-64 hover:shadow-xl hover:scale-105 transition-all cursor-pointer text-left"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <FontAwesomeIcon icon={faWarehouse} className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Warehouse</h2>
              <p className="text-gray-600 text-sm">For warehouse managers and staff</p>
            </div>
          </button>

          {/* Driver Card */}
          <button
            onClick={() => navigate('/driver/login')}
            className="bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl p-8 w-64 hover:shadow-xl hover:scale-105 transition-all cursor-pointer text-left"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <FontAwesomeIcon icon={faTruck} className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Driver</h2>
              <p className="text-gray-600 text-sm">For delivery drivers</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
