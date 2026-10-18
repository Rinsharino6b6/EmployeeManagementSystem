
public class Developer extends Employee {

    public Developer(String id, String name,
                     String department, double salary) {
        super(id, name, department, salary);
    }

    @Override
    public String getRole() {
        return "Developer";
    }

    @Override
    public double calculateBonus() {
        return getSalary() * 0.10;
    }
}
