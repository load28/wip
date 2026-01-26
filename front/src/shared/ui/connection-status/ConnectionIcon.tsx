'use client';

import { useAtomValue } from 'jotai';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon from '@mui/icons-material/Sync';
import { connectionStatusAtom } from '@/shared/store/connection';

export const ConnectionIcon = () => {
  const status = useAtomValue(connectionStatusAtom);

  const icons = {
    online: <WifiIcon className="text-green-500" />,
    offline: <WifiOffIcon className="text-gray-400" />,
    syncing: <SyncIcon className="animate-spin text-blue-500" />,
  };

  return (
    <div title={status} className="flex items-center">
      {icons[status]}
    </div>
  );
};
