import { useState } from 'react';
import { fetchAllFolders } from '../utils/fetchSortlyFolders';

export default function FolderFetcher() {
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const handleFetch = async () => {
    setLoading(true);
    try {
      await fetchAllFolders();
      setComplete(true);
    } catch (error) {
      console.error('Error fetching folders:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4">Sortly Folder Fetcher</h1>
        <p className="text-gray-600 mb-6">
          Click the button below to fetch all Sortly folders and display them in the console.
        </p>
        
        <button
          onClick={handleFetch}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Fetching...' : complete ? 'Fetch Again' : 'Fetch Folders'}
        </button>

        {complete && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">
              ✓ Check your browser console (F12) to see the folder structure!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}