interface ProfileHeaderProps {
  name: string | null
  email: string
  avatarUrl: string | null
}

export default function ProfileHeader({ name, email, avatarUrl }: ProfileHeaderProps) {
  return (
    <div className="profile__header">
      {avatarUrl ? (
        <img className="profile__avatar" src={avatarUrl} alt={name ?? ''} />
      ) : (
        <div className="profile__avatar-placeholder">
          {name?.charAt(0).toUpperCase() ?? '👤'}
        </div>
      )}
      <div className="profile__info">
        <div className="profile__name">{name ?? 'Mon profil'}</div>
        <div className="profile__email">{email}</div>
      </div>
    </div>
  )
}