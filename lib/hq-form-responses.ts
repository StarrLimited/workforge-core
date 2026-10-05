export type FormResponse = {
  id: string; source: string; formId: string; formName: string; submittedAt: string;
  answers: { question: string; answer: string }[];
  campaign: string; ad: string;
};

const labels: Record<string, string> = {
  interest: 'What would you like to explore?',
  role: 'What is your role?',
  team_size: 'How many people work in your business, including you?',
  current_software: 'What is your main business software today?',
  full_name: 'Full name', email: 'Email', phone_number: 'Phone number', company_name: 'Company name',
};
const options: Record<string, string> = {
  owner: 'Owner', sales_leader: 'Sales leader', other: 'Other', just_me: 'Just me',
  not_sure_yet: 'Not sure yet', a_custom_crm: 'A custom CRM',
  a_complete_business_management_system: 'A complete business management system',
  no_system_yet: 'No system yet', another_crm_or_platform: 'Another CRM or platform',
  'texts_&_emails': 'Texts & emails', service_titan: 'ServiceTitan', housecall: 'Housecall',
};
const textValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.trim() : '';
};
export function responseAnswers(attribution: Record<string, unknown>, website = false) {
  const raw = attribution.answers;
  // Older website receipts kept qualification answers directly in attribution.
  const answers = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw : website ? Object.fromEntries(['Business Type', 'Main Challenge', 'Team Size'].map(k => [k, attribution[k]])) : {};
  return Object.entries(answers).flatMap(([key, value]) => {
    const answer = textValue(value);
    if (!answer) return [];
    const words = key.replaceAll('_', ' ');
    const question = labels[key.toLowerCase()] || words.charAt(0).toUpperCase() + words.slice(1);
    return [{ question, answer: options[answer] || answer }];
  });
}
