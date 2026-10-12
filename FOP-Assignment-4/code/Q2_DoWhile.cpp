/*
 * Assignment 4 - Question 2 (do-while version)
 * Purpose : Display the sentence "I Love Programming" X times,
 *           where X is entered by the user, using a do-while loop.
 */
#include <iostream>
using namespace std;

int main()
{
    int x;          // number of times, entered by the user
    int count = 1;  // loop counter

    cout << "How many times to display the sentence? ";
    cin >> x;
    cout << endl;

    // a do-while loop always runs at least once,
    // so first make sure that x is a positive number
    if (x > 0)
    {
        do
        {
            cout << "I Love Programming" << endl;
            count++;
        } while (count <= x);
    }

    return 0;
}
