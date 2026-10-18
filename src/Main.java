
import java.util.Scanner;

public class Main {

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        EmployeeService service = new EmployeeService();

        while (true) {
            System.out.println("\n=== Employee Management ===");
            System.out.println("1. Add Employee");
            System.out.println("2. View Employees");
            System.out.println("3. Search Employee");
            System.out.println("4. Update Employee");
            System.out.println("5. Delete Employee");
            System.out.println("6. Exit");
            System.out.print("Enter choice: ");

            int choice = sc.nextInt();
            sc.nextLine();

            switch (choice) {
                case 1:
                    System.out.println("1. Employee");
                    System.out.println("2. Manager");
                    System.out.println("3. Developer");
                    System.out.print("Choose type: ");
                    int type = sc.nextInt();
                    sc.nextLine();

                    System.out.print("Enter ID: ");
                    String id = sc.nextLine();

                    System.out.print("Enter name: ");
                    String name = sc.nextLine();

                    System.out.print("Enter department: ");
                    String dept = sc.nextLine();

                    System.out.print("Enter salary: ");
                    double salary = sc.nextDouble();
                    sc.nextLine();

                    Employee emp;

                    if (type == 1) {
                        emp = new Employee(
                            id, name, dept, salary);
                    } else if (type == 2) {
                        emp = new Manager(
                            id, name, dept, salary);
                    } else if (type == 3) {
                        emp = new Developer(
                            id, name, dept, salary);
                    } else {
                        System.out.println("Invalid type.");
                        break;
                    }

                    service.addEmployee(emp);
                    break;

                case 2:
                    service.viewEmployees();
                    break;

                case 3:
                    System.out.print("Enter employee ID: ");
                    String searchId = sc.nextLine();

                    Employee found =
                        service.findEmployee(searchId);

                    if (found != null) {
                        found.displayDetails();
                    } else {
                        System.out.println("Employee not found.");
                    }
                    break;

                case 4:
                    System.out.print("Enter employee ID: ");
                    String updateId = sc.nextLine();

                    System.out.print("Enter new name: ");
                    String newName = sc.nextLine();

                    System.out.print("Enter new department: ");
                    String newDept = sc.nextLine();

                    System.out.print("Enter new salary: ");
                    double newSalary = sc.nextDouble();
                    sc.nextLine();

                    if (service.updateEmployee(
                        updateId, newName,
                        newDept, newSalary)) {
                        System.out.println("Updated successfully.");
                    } else {
                        System.out.println("Employee not found.");
                    }
                    break;

                case 5:
                    System.out.print("Enter employee ID: ");
                    String deleteId = sc.nextLine();

                    if (service.deleteEmployee(deleteId)) {
                        System.out.println("Deleted successfully.");
                    } else {
                        System.out.println("Employee not found.");
                    }
                    break;

                case 6:
                    System.out.println("Application closed.");
                    sc.close();
                    return;

                default:
                    System.out.println("Invalid choice.");
            }
        }
    }
}
