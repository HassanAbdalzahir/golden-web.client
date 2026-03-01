export function formatGold(milligrams: string | number): string {
  const mg = typeof milligrams === 'string' ? parseFloat(milligrams) : milligrams;
  const grams = mg / 1000;
  
  if (grams < 1) {
    return `${mg.toLocaleString()} mg`;
  } else if (grams < 1000) {
    return `${grams.toLocaleString(undefined, { maximumFractionDigits: 3 })} g`;
  } else {
    const kg = grams / 1000;
    return `${kg.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`;
  }
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const target = new Date(date);
  const diffInMs = now.getTime() - target.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  const diffInDays = diffInHours / 24;
  
  if (diffInHours < 1) {
    const minutes = Math.floor(diffInMs / (1000 * 60));
    return `${minutes} minutes ago`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`;
  } else if (diffInDays < 7) {
    return `${Math.floor(diffInDays)} days ago`;
  } else {
    return formatDate(date);
  }
}