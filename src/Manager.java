
public class Manager extends Employee {

    public Manager(String id, String name,
                   String department, double salary) {
        super(id, name, department, salary);
    }

    @Override
    public String getRole() {
        return "Manager";
    }

    @Override
    public double calculateBonus() {
        return getSalary() * 0.15;
    }
}
