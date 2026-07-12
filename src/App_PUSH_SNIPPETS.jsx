// ASR Iron WhatsApp-like Push Integration Snippets
// Use these snippets in your current src/App.jsx if you want to merge manually.

// 1) Add these imports near the top:
import { enablePushForUser, sendSystemPushNotification, isPushSupported, getPushPermission } from './pushNotifications';

// 2) Add this state inside App():
const [pushPermission, setPushPermission] = useState(getPushPermission());

// 3) Add this function inside App():
async function enablePhoneNotifications() {
  const subscription = await enablePushForUser(user, setToast);
  setPushPermission(getPushPermission());
  return subscription;
}

// 4) In your sendNotification(e) function, after inserting/saving your in-app notification, add:
try {
  await sendSystemPushNotification({
    target,
    title: newNotification.title.trim(),
    message: newNotification.message.trim()
  });
} catch (err) {
  console.warn('Push send failed', err);
}

// 5) Add this small button somewhere visible after login, e.g. in Header() or notificationPanel():
{isPushSupported() && pushPermission !== 'granted' && (
  <button className="btn btn-gold" onClick={enablePhoneNotifications}>
    Enable Phone Notifications
  </button>
)}

// 6) For iPhone users: they must open the Vercel site in Safari, Add to Home Screen,
// launch the installed app icon, then tap Enable Phone Notifications.
