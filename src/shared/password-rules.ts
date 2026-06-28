export function checkComplexity(plainPassword: string): string[] {
  const errors: string[] = [];
  if (plainPassword.length < 8) {
    errors.push('Password must be at least 8 characters long.')
  }

  // Add more rules if applicable
  return errors;
}