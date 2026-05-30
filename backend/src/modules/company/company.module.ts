import { Module } from '@nestjs/common';
import { EmployeesModule } from './employees/employees.module';

@Module({
  imports: [EmployeesModule],
  exports: [EmployeesModule],
})
export class CompanyModule {}
