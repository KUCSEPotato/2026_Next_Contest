import { AuthorInfo, User } from "../_types";

const BG_COLORS = [
  "bg-red-400",
  "bg-orange-400",
  "bg-amber-400",
  "bg-teal-400",
  "bg-indigo-400",
];

export default function Avatar({
  user,
  size = 36,
}: {
  user: AuthorInfo | User;
  size?: number;
}) {
  const bg = BG_COLORS[user.id % BG_COLORS.length];
  const avatarUrl = "avatar_url" in user ? user.avatar_url : null;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={user.nickname}
        className="flex-shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex-shrink-0 rounded-full ${bg} flex items-center justify-center font-bold text-white`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {user.nickname.charAt(0)}
    </div>
  );
}
