/*
 * Assignment 4 - Question 4
 * Author  : Ahmed Mohamed Fathi (F25SP2826), Section 31
 * Purpose : Calculate the salary for one week based on the
 *           working hours of each working day.
 *           Rate for 1 hour = RM 8.00
 */
#include <iostream>
using namespace std;

int main()
{
    const double RATE = 8.00;   // pay for 1 hour (RM)

    int x, day;                         // x = working days, day = counter
    double hour, salary, total = 0.0;   // total = total working hours

    // Step 1: get the number of working days (only 1 to 7 allowed)
    do
    {
        cout << "How many working days for this week? ";
        cin >> x;

        if (x > 7)
            cout << "Only 7 days a week." << endl;
        else if (x < 1)
            cout << "Please enter at least 1 day." << endl;
    } while (x < 1 || x > 7);

    // Step 2: get the working hours of each day and add them up
    for (day = 1; day <= x; day++)
    {
        cout << "Working hour Day " << day << ": ";
        cin >> hour;
        total += hour;
    }

    // Step 3: calculate and display the total hours and salary
    salary = total * RATE;

    cout << endl;
    cout << "Total hours : " << total << endl;
    cout << "Your salary : RM" << salary << endl;

    return 0;
}
