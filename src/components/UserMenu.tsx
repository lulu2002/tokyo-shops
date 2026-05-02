import type { User } from '@supabase/supabase-js';

interface Props {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function UserMenu({ user, onSignIn, onSignOut }: Props) {
  if (!user) {
    return (
      <button
        onClick={onSignIn}
        className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        登入
      </button>
    );
  }

  const avatar = user.user_metadata?.avatar_url;
  const name = user.user_metadata?.full_name || user.email?.split('@')[0] || '';

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 hidden sm:inline">{name}</span>
      {avatar ? (
        <img src={avatar} alt="" className="w-8 h-8 rounded-full" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm text-white font-medium">
          {name[0]?.toUpperCase()}
        </div>
      )}
      <button
        onClick={onSignOut}
        className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition-colors"
      >
        登出
      </button>
    </div>
  );
}
