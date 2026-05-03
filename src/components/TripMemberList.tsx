import type { TripMember, PresenceUser, TripRole } from '../types/trip';

interface Props {
  members: TripMember[];
  onlineUsers: PresenceUser[];
  currentUserId: string | null;
  onRemove?: (userId: string) => void;
  onClose: () => void;
}

const roleLabels: Record<TripRole, string> = {
  owner: '擁有者',
  editor: '編輯者',
  viewer: '檢視者',
};

const roleBadgeColors: Record<TripRole, string> = {
  owner: 'bg-amber-100 text-amber-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

export function TripMemberList({ members, onlineUsers, currentUserId, onRemove, onClose }: Props) {
  const onlineSet = new Set(onlineUsers.map(u => u.userId));

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-72 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">行程成員</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {members.map(member => {
          const isOnline = onlineSet.has(member.userId);
          const isMe = member.userId === currentUserId;
          return (
            <div key={member.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50">
              {/* Avatar */}
              <div className="relative shrink-0">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-white text-sm font-bold">
                    {(member.displayName || '?')[0].toUpperCase()}
                  </div>
                )}
                {isOnline && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />
                )}
              </div>
              {/* Name + role */}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-800 truncate">
                  {member.displayName || '匿名使用者'}
                  {isMe && <span className="text-gray-400 ml-1">(你)</span>}
                </div>
                <span className={`text-xs px-1.5 py-0.5 rounded ${roleBadgeColors[member.role]}`}>
                  {roleLabels[member.role]}
                </span>
              </div>
              {/* Remove button (owner can remove others) */}
              {onRemove && !isMe && member.role !== 'owner' && (
                <button
                  onClick={() => onRemove(member.userId)}
                  className="text-xs text-red-400 hover:text-red-600 shrink-0"
                >
                  移除
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
