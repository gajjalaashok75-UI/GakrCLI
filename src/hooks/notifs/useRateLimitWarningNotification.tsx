import { useEffect, useMemo, useRef, useState } from 'react';
import { useNotifications } from 'src/context/notifications.js';
import { Text } from 'src/ink.js';
import { getRateLimitWarning, getUsingOverageText } from 'src/services/gakrcliAiLimits.js';
import { useGakrCLIAiLimits } from 'src/services/gakrcliAiLimitsHook.js';
import { getSubscriptionType } from 'src/utils/auth.js';
import { hasGakrCLIAiBillingAccess } from 'src/utils/billing.js';
import { getIsRemoteMode } from '../../bootstrap/state.js';

export function useRateLimitWarningNotification(model: string): void {
  const { addNotification } = useNotifications();
  const gakrCLIAiLimits = useGakrCLIAiLimits();
  // gakrCLIAiLimits reference is stable until statusListeners fire (API
  // response), so these skip the Intl formatting work on most REPL renders.
  const rateLimitWarning = useMemo(() => getRateLimitWarning(gakrCLIAiLimits, model), [gakrCLIAiLimits, model]);
  const usingOverageText = useMemo(() => getUsingOverageText(gakrCLIAiLimits), [gakrCLIAiLimits]);
  const shownWarningRef = useRef<string | null>(null);
  const subscriptionType = getSubscriptionType();
  const hasBillingAccess = hasGakrCLIAiBillingAccess();
  const isTeamOrEnterprise = subscriptionType === 'team' || subscriptionType === 'enterprise';

  // Track overage mode transitions
  const [hasShownOverageNotification, setHasShownOverageNotification] = useState(false);

  // Show immediate notification when entering overage mode
  useEffect(() => {
    if (getIsRemoteMode()) return;
    if (gakrCLIAiLimits.isUsingOverage && !hasShownOverageNotification && (!isTeamOrEnterprise || hasBillingAccess)) {
      addNotification({
        key: 'limit-reached',
        text: usingOverageText,
        priority: 'immediate',
      });
      setHasShownOverageNotification(true);
    } else if (!gakrCLIAiLimits.isUsingOverage && hasShownOverageNotification) {
      // Reset when no longer in overage mode
      setHasShownOverageNotification(false);
    }
  }, [
    gakrCLIAiLimits.isUsingOverage,
    usingOverageText,
    hasShownOverageNotification,
    addNotification,
    hasBillingAccess,
    isTeamOrEnterprise,
  ]);

  // Show warning notification for approaching limits
  useEffect(() => {
    if (getIsRemoteMode()) return;
    if (rateLimitWarning && rateLimitWarning !== shownWarningRef.current) {
      shownWarningRef.current = rateLimitWarning;
      addNotification({
        key: 'rate-limit-warning',
        jsx: (
          <Text>
            <Text color="warning">{rateLimitWarning}</Text>
          </Text>
        ),
        priority: 'high',
      });
    }
  }, [rateLimitWarning, addNotification]);
}
