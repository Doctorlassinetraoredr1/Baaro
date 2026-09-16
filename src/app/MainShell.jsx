const tabProps = {
  feed: {
    id,
    onOpenProfile: (authorId) => setInspectingProfileId(authorId),
    onRewardPoints: earnPoints,
  },
  friends: { id, onOpenProfile: (authorId) => setInspectingProfileId(authorId) },
  community: { id, onOpenProfile: (authorId) => setInspectingProfileId(authorId) }, // <- ton CommunityTab optimisé
  videos: { id, onRewardPoints: earnPoints, onExit: () => setActiveTab("feed") },
  messages: { id, onRewardPoints: earnPoints, onOpenProfile: (authorId) => setInspectingProfileId(authorId) },
  wallet: { onNavigateToCrypto: () => setActiveTab("crypto") },
  crypto: {},
  debates: { id, onRewardPoints: earnPoints, onOpenProfile: (authorId) => setInspectingProfileId(authorId) },
  offline: { onRewardPoints: earnPoints },
  assistant: { id, userProfile, pointsBalance, baroBalance, onRewardPoints: earnPoints },
  settings: { id, userProfile, setUserProfile, currentTheme, onSelectTheme: setCurrentTheme, onReplayOnboarding: () => setForceOnboarding(true) },
  shop: { id },
};
