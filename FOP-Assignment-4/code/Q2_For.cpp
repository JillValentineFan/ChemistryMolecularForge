/*
 * Assignment 4 - Question 2 (for version)
 * Author  : Ahmed Mohamed Fathi (F25SP2826), Section 31
 * Purpose : Display the sentence "I Love Programming" X times,
 *           where X is entered by the user, using a for loop.
 */
#include <iostream>
using namespace std;

int main()
{
    int x;  // number of times, entered by the user

    cout << "How many times to display the sentence? ";
    cin >> x;
    cout << endl;

    // for: start, condition and update are written in one line
    for (int count = 1; count <= x; count++)
    {
        cout << "I Love Programming" << endl;
    }

    return 0;
}
