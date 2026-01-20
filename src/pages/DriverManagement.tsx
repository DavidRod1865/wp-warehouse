import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPen } from '@fortawesome/free-solid-svg-icons';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseDriverAuth } from '../lib/supabase';
import { sortlyClient } from '../lib/sortly';
import type { SortlyItem } from '../types/sortly';

interface DriverUser {
  id: string;
  email: string | null;
  username: string | null;
  active: boolean;
  driver_sortly_folder_id: number | null;
}

const DELIVERY_TRUCKS_FOLDER_ID = 102892637;

export default function DriverManagement() {
  const navigate = useNavigate();
  const [drivers, setDrivers] = useState<DriverUser[]>([]);
  const [truckFolders, setTruckFolders] = useState<SortlyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [editingUsername, setEditingUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>(
    {}
  );

  const normalizeUsername = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');

  const usernameToAlias = (value: string) => {
    const normalized = normalizeUsername(value);
    return normalized
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/\.+/g, '.')
      .replace(/^\.|\.$/g, '');
  };

  const toDisplayName = (value: string) =>
    value
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFolderId, setNewFolderId] = useState<number | null>(null);

  const folderNameById = useMemo(() => {
    return new Map(truckFolders.map((folder) => [folder.id, folder.name]));
  }, [truckFolders]);

  const assignedFolderIds = useMemo(() => {
    return new Set(
      drivers
        .map((driver) => driver.driver_sortly_folder_id)
        .filter((id): id is number => typeof id === 'number')
    );
  }, [drivers]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const driverResult = await supabase
          .from('users')
          .select('id, email, username, active, driver_sortly_folder_id')
          .eq('role', 'driver')
          .order('email');

        const folders: SortlyItem[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const response = await sortlyClient.listItems({
            parent_id: 102892637,
            per_page: 100,
            page,
          });
          const items = response.data || [];
          folders.push(
            ...items.filter(
              (item: SortlyItem) =>
                item.type === 'folder' &&
                item.parent_id === DELIVERY_TRUCKS_FOLDER_ID
            )
          );
          hasMore = items.length === 100;
          page += 1;
        }

        if (driverResult.error) throw driverResult.error;
        setDrivers((driverResult.data || []) as DriverUser[]);
        setTruckFolders(folders);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load drivers');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const refreshDrivers = async () => {
    const { data, error: driverError } = await supabase
      .from('users')
      .select('id, email, username, active, driver_sortly_folder_id')
      .eq('role', 'driver')
      .order('email');

    if (driverError) {
      throw driverError;
    }
    setDrivers((data || []) as DriverUser[]);
  };

  const handleCreateDriver = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!newUsername.trim() || !newPassword.trim()) {
      setError('Username and password are required for new drivers.');
      return;
    }

    if (!/^[a-z0-9._-]+( [a-z0-9._-]+)*$/i.test(newUsername.trim())) {
      setError(
        'Username can only include letters, numbers, spaces, dots, _ or -.'
      );
      return;
    }

    setSaving(true);
    try {
      const normalizedUsername = normalizeUsername(newUsername);
      const alias = usernameToAlias(normalizedUsername);
      const emailAlias = `${alias}@drivers.local`;
      const { data, error: signUpError } =
        await supabaseDriverAuth.auth.signUp({
          email: emailAlias,
          password: newPassword.trim(),
        });

      if (signUpError) {
        if (signUpError.message?.toLowerCase().includes('user already registered')) {
          const accessToken = await getAccessToken();
          const { data: linkData, error: linkError } =
            await supabase.functions.invoke('link-driver-profile', {
              body: {
                username: normalizedUsername,
                driverFolderId: newFolderId,
              },
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

          if (linkError) throw linkError;
          if (!linkData?.success) {
            throw new Error(
              'User already registered, but no profile was found. Ask a manager to reset the password or contact support.'
            );
          }

          setSuccess('Driver account linked and folder updated.');
          setNewUsername('');
          setNewPassword('');
          setNewFolderId(null);
          await refreshDrivers();
          return;
        }

        throw signUpError;
      }

      if (!data.user) throw new Error('Driver user was not created.');

      const { error: profileError } = await supabase.from('users').upsert({
        id: data.user.id,
        email: emailAlias,
        username: normalizedUsername,
        role: 'driver',
        active: true,
        driver_sortly_folder_id: newFolderId,
      });

      if (profileError) throw profileError;

      setSuccess(
        'Driver account created. Share the username and password with the driver.'
      );
      setNewUsername('');
      setNewPassword('');
      setNewFolderId(null);
      await refreshDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create driver');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignFolder = async (
    driverId: string,
    folderId: number | null
  ) => {
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          driver_sortly_folder_id: folderId,
        })
        .eq('id', driverId);

      if (updateError) throw updateError;
      await refreshDrivers();
      setSuccess('Driver folder updated.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update driver folder'
      );
    } finally {
      setSaving(false);
    }
  };

  const getAccessToken = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      accessToken = refreshed.session?.access_token;
    }
    if (!accessToken) {
      throw new Error('Not authenticated. Please sign in again.');
    }
    return accessToken;
  };

  const handleResetPassword = async (driverId: string) => {
    setError('');
    setSuccess('');
    setResettingId(driverId);

    try {
      const accessToken = await getAccessToken();
      const { data, error: resetError } = await supabase.functions.invoke(
        'reset-driver-password',
        {
          body: { userId: driverId },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (resetError) throw resetError;
      if (!data?.tempPassword) {
        throw new Error('No password returned from reset.');
      }

      setResetPasswords((prev) => ({
        ...prev,
        [driverId]: data.tempPassword as string,
      }));
      setSuccess('Temporary password generated. Share it with the driver.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reset password'
      );
    } finally {
      setResettingId(null);
    }
  };

  const handleDeleteDriver = async (driverId: string, driverName: string) => {
    const confirmed = window.confirm(
      `Delete user "${driverName}"? This removes the user but does not delete the truck folder.`
    );

    if (!confirmed) return;

    setError('');
    setSuccess('');
    setDeletingId(driverId);

    try {
      const accessToken = await getAccessToken();
      const { error: deleteError } = await supabase.functions.invoke(
        'delete-driver',
        {
          body: { userId: driverId },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (deleteError) throw deleteError;

      setSuccess('Driver deleted successfully.');
      setResetPasswords((prev) => {
        const next = { ...prev };
        delete next[driverId];
        return next;
      });
      await refreshDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete driver');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditDriver = (driver: DriverUser) => {
    setEditingDriverId(driver.id);
    setEditingUsername(driver.username || '');
  };

  const handleSaveDriverName = async (driver: DriverUser) => {
    const normalizedUsername = normalizeUsername(editingUsername);
    if (!normalizedUsername) {
      setError('Username is required.');
      return;
    }

    if (!/^[a-z0-9._-]+( [a-z0-9._-]+)*$/i.test(normalizedUsername)) {
      setError(
        'Username can only include letters, numbers, spaces, dots, _ or -.'
      );
      return;
    }

    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const accessToken = await getAccessToken();
      const { error: updateError } = await supabase.functions.invoke(
        'update-driver-username',
        {
          body: {
            userId: driver.id,
            username: normalizedUsername,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (updateError) throw updateError;

      setSuccess('Driver username updated.');
      setEditingDriverId(null);
      setEditingUsername('');
      await refreshDrivers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update driver name'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Driver Management
            </h1>
            <p className="text-sm text-gray-600">
              Create driver logins and link them to truck folders.
            </p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Create Driver Login
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Provide a username and a temporary password, then share those details
            with the driver.
          </p>

          <form
            onSubmit={handleCreateDriver}
            className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver Username
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="driver01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temporary Password
              </label>
              <input
                type="text"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Set a password"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Truck Folder
              </label>
              <select
                value={newFolderId || ''}
                onChange={(event) =>
                  setNewFolderId(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">Assign later</option>
                {truckFolders
                  .filter((folder) => !assignedFolderIds.has(folder.id))
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium"
              >
                {saving ? 'Creating...' : 'Create Driver'}
              </button>
            </div>
          </form>
        </section>

        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Assigned Drivers
          </h2>

          {loading ? (
            <p className="text-sm text-gray-500 mt-4">Loading drivers...</p>
          ) : drivers.length === 0 ? (
            <p className="text-sm text-gray-500 mt-4">
              No drivers found yet.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >
                  <div>
                    {editingDriverId === driver.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingUsername}
                          onChange={(event) => setEditingUsername(event.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="driver01"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveDriverName(driver)}
                          className="px-3 py-2 border border-blue-200 rounded-lg text-sm text-blue-700 hover:bg-blue-50"
                          disabled={saving}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDriverId(null);
                            setEditingUsername('');
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          {driver.username
                            ? toDisplayName(driver.username)
                            : driver.email || 'No username'}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleEditDriver(driver)}
                          className="text-blue-600 hover:text-blue-800"
                          aria-label="Edit driver name"
                          title="Edit driver name"
                        >
                          <FontAwesomeIcon icon={faPen} className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      Status: {driver.active ? 'Active' : 'Inactive'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Truck:{' '}
                      {driver.driver_sortly_folder_id
                        ? folderNameById.get(driver.driver_sortly_folder_id) ||
                          'Unknown folder'
                        : 'Not assigned'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={driver.driver_sortly_folder_id || ''}
                      onChange={(event) =>
                        handleAssignFolder(
                          driver.id,
                          event.target.value ? Number(event.target.value) : null
                        )
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      disabled={saving}
                    >
                      <option value="">Assign truck</option>
                      {truckFolders
                        .filter(
                          (folder) =>
                            !assignedFolderIds.has(folder.id) ||
                            folder.id === driver.driver_sortly_folder_id
                        )
                        .map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleResetPassword(driver.id)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                      disabled={resettingId === driver.id}
                    >
                      {resettingId === driver.id ? 'Resetting...' : 'Reset'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteDriver(
                          driver.id,
                          driver.username || driver.email || 'Driver'
                        )
                      }
                      className="px-3 py-2 border border-red-200 rounded-lg text-sm text-red-700 hover:bg-red-50"
                      disabled={deletingId === driver.id}
                    >
                      {deletingId === driver.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                  {resetPasswords[driver.id] && (
                    <p className="text-xs text-blue-600 mt-2">
                      Temporary password: {resetPasswords[driver.id]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
