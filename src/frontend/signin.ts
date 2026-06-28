import { FieldError } from "./field-error";

const passwordField = document.getElementById('password') as HTMLInputElement;
const passwordInvalidLabel =  document.getElementById('invalid-password') as HTMLInputElement;

const emailField = document.getElementById('email') as HTMLInputElement;
const emailInvalidLabel =  document.getElementById('invalid-email') as HTMLInputElement;

const submitBtm = document.getElementById('form-submit');

const errors = new FieldError();

function updateSubmitBtn(): void {
  if(errors.isEmpty() && emailField.value.length && passwordField.value.length){
    submitBtm?.classList.remove('btn-disabled');
  } else {
    submitBtm?.classList.add('btn-disabled');
  }
}

emailField.addEventListener('input', (_) =>{
  updateSubmitBtn();
});

passwordField.addEventListener('input', (_) =>{
  updateSubmitBtn();
});