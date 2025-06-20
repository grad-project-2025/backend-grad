import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isIataCode', async: false })
export class IsIataCodeConstraint implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments) {
    return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid 3-letter IATA code`;
  }
}

// This is the actual decorator
export function IsIataCode(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIataCodeConstraint,
    });
  };
}
