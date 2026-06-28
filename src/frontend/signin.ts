import { FieldError } from "./field-error";
import { checkComplexity } from "../shared/password-rules";
import { checkUsername } from "../shared/username-rules";

const passwordField = document.getElementById('password') as HTMLInputElement;
const passwordInvalidLabel =  document.getElementById('invalid-password') as HTMLInputElement;

const emailField = document.getElementById('email') as HTMLInputElement;
const emailInvalidLabel =  document.getElementById('invalid-email') as HTMLInputElement;

const submitBtm = document.getElementById('form-submit');

const errors = new FieldError();

function updateSubmitBtn(): void {
  if(errors.isEmpty() && emailField.value.length > 0 && passwordField.value.length > 0){
    submitBtm?.classList.remove('btn-disabled');
  } else {
    submitBtm?.classList.add('btn-disabled');
  }
}

emailField.addEventListener('input', (_) =>{
  const userNameFailures = checkUsername(emailField.value);
  if(userNameFailures.length > 0){
    const formattedErrors = userNameFailures.join('<br>');
    errors.set('invalid-email', emailField, emailInvalidLabel, formattedErrors);
  } else {
    errors.remove('invalid-email', emailField, emailInvalidLabel)
  }
  updateSubmitBtn();
});

passwordField.addEventListener('input', (_) =>{
  const passwordFailures = checkComplexity(passwordField.value);
  if(passwordFailures.length > 0){
    const formattedErrors = passwordFailures.join('<br>');
    errors.set('invalid-password', passwordField, passwordInvalidLabel, formattedErrors);
  } else {
    errors.remove('invalid-password', passwordField, passwordInvalidLabel);
  }
  updateSubmitBtn();
});