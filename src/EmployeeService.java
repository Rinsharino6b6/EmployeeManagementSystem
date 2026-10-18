
import java.util.ArrayList;

public class EmployeeService {

    private ArrayList<Employee> employees =
            new ArrayList<>();

    public boolean addEmployee(Employee employee) {
        if (findEmployee(employee.getId()) != null) {
            System.out.println("Employee ID already exists.");
            return false;
        }

        employees.add(employee);
        System.out.println("Employee added successfully.");
        return true;
    }

    public void viewEmployees() {
        if (employees.isEmpty()) {
            System.out.println("No employees found.");
            return;
        }

        for (Employee employee : employees) {
            System.out.println("--------------------");
            employee.displayDetails();
        }
    }

    public Employee findEmployee(String id) {
        for (Employee employee : employees) {
            if (employee.getId().equalsIgnoreCase(id)) {
                return employee;
            }
        }

        return null;
    }

    public boolean updateEmployee(
            String id, String name,
            String department, double salary) {

        Employee employee = findEmployee(id);

        if (employee == null) {
            return false;
        }

        employee.setName(name);
        employee.setDepartment(department);
        employee.setSalary(salary);
        return true;
    }

    public boolean deleteEmployee(String id) {
        Employee employee = findEmployee(id);

        if (employee == null) {
            return false;
        }

        employees.remove(employee);
        return true;
    }
}
