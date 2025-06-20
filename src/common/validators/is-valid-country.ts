import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import countryList from 'country-list'; // Default import

@ValidatorConstraint({ name: 'isValidCountry', async: false })
export class IsValidCountryConstraint implements ValidatorConstraintInterface {
  validate(country: string, args: ValidationArguments) {
    const countries = countryList.getNames(); // Array of country names (e.g., ["Afghanistan", "Egypt", ...])
    const countryCodes = countryList.getCodes(); // Array of ISO 3166-1 alpha-2 codes (e.g., ["AF", "EG", ...])
    return (
      typeof country === 'string' &&
      (countries.includes(country) ||
        countryCodes.includes(country.toUpperCase()))
    );
  }

  defaultMessage(args: ValidationArguments) {
    return 'Country must be a valid country name or ISO 3166-1 alpha-2/alpha-3 code';
  }
}

export function IsValidCountry(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCountry',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidCountryConstraint,
    });
  };
}
