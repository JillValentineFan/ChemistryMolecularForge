/*
 * Assignment 4 - Question 3
 * Purpose : Ask the user for the number of rows and display
 *           a number pattern. Example for 5 rows:
 *             1
 *             1 2
 *             1 2 3
 *             1 2 3 4
 *             1 2 3 4 5
 */
#include <iostream>
using namespace std;

int main()
{
    int rows;   // number of rows, entered by the user

    cout << "How many rows? ";
    cin >> rows;
    cout << endl;

    // outer loop: one repetition for each row
    for (int i = 1; i <= rows; i++)
    {
        // inner loop: print the numbers 1 up to the row number
        for (int j = 1; j <= i; j++)
        {
            cout << j << " ";
        }
        cout << endl;   // move to the next row
    }

    return 0;
}
